import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser, forbidNonWriter } from '@/lib/auth';
import { getValidAccessToken, gmailFetch } from '@/lib/gmail';
import { safeHttpUrl, isValidEmail } from '@/lib/validation';
import { enforceRateLimit, RATE_PRESETS } from '@/lib/ratelimit';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Fetch the plain-text body from a Gmail message payload
function extractBody(payload: {
  mimeType?: string;
  body?: { data?: string };
  parts?: { mimeType?: string; body?: { data?: string } }[];
}): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    }
    // Fallback: first part with any body
    for (const part of payload.parts) {
      if (part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    }
  }
  return '';
}

// Generate next bid ID: BID-YYYY-NNN. Takes the NUMERIC max of existing ids —
// ordering by id text would rank BID-2026-1000 below BID-2026-999 and reissue a
// colliding id. Callers must still handle a PK conflict on insert (concurrent
// detect-bids runs can compute the same next id before either commits).
async function nextBidId(serviceClient: ReturnType<typeof createServiceClient>, workspaceId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BID-${year}-`;
  const { data } = await serviceClient
    .from('bids')
    .select('id')
    .eq('workspace_id', workspaceId)
    .like('id', `${prefix}%`);
  let max = 0;
  for (const row of data ?? []) {
    const n = parseInt(String(row.id).slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const denied = forbidNonWriter(auth.role);
  if (denied) return denied;
  const user = auth.user;
  const workspaceId = auth.workspaceId;

  const serviceClient = createServiceClient();
  const limited = await enforceRateLimit(serviceClient, { userId: user.id, workspaceId, route: 'gmail-detect', rules: RATE_PRESETS.gmailScan });
  if (limited) return limited;

  try {
    const accessToken = await getValidAccessToken(user.id);

    // Fetch recent inbox emails with bid-related keywords
    const listRes = await gmailFetch(
      accessToken,
      '/messages?q=in:inbox+subject:(bid+OR+"invitation+to+bid"+OR+"request+for+proposal"+OR+"RFP"+OR+"RFQ"+OR+"subcontractor+bid"+OR+"bid+invitation"+OR+estimate+OR+quote)&maxResults=30'
    );
    if (!listRes.ok) throw new Error('Failed to list Gmail messages');
    const listData = await listRes.json();
    const messages: { id: string }[] = listData.messages ?? [];

    let detected = 0;
    let skipped = 0;

    for (const msg of messages) {
      // Fetch full message
      const msgRes = await gmailFetch(accessToken, `/messages/${msg.id}?format=full`);
      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();

      const headers: { name: string; value: string }[] = msgData.payload?.headers ?? [];
      const subject = headers.find(h => h.name === 'Subject')?.value ?? '';
      const fromHeader = headers.find(h => h.name === 'From')?.value ?? '';
      const threadId: string = msgData.threadId ?? msg.id;
      const internalDate = msgData.internalDate
        ? new Date(parseInt(msgData.internalDate)).toISOString()
        : new Date().toISOString();

      // Skip if we already have a bid with this thread ID
      const { data: existingBid } = await serviceClient
        .from('bids')
        .select('id')
        .eq('thread_id', threadId)
        .eq('workspace_id', workspaceId)
        .limit(1)
        .maybeSingle();
      if (existingBid) { skipped++; continue; }

      const body = extractBody(msgData.payload);
      const emailText = `From: ${fromHeader}\nSubject: ${subject}\n\n${body}`.slice(0, 4000);

      const prompt = `You analyze construction subcontractor bid invitation emails for NGU Construction (a site work and paving company in Texas).

Email:
${emailText}

Determine if this email is a genuine bid invitation asking NGU to submit a bid/quote/estimate as a subcontractor.

If YES, extract the bid information and return this exact JSON:
{
  "is_bid": true,
  "project_name": "string (required)",
  "address": "string or null",
  "city": "string or null",
  "state": "TX",
  "gc_name": "string or null",
  "gc_email": "string or null",
  "gc_contact_name": "string or null",
  "gc_contact_phone": "string or null",
  "bid_due_date": "YYYY-MM-DD or null",
  "bid_due_time": "HH:MM AM/PM or null",
  "scope": "short description of the work scope",
  "trades": ["array", "of", "trade", "names"],
  "plans_link": "URL if present or null",
  "source": "PlanHub or Procore or Novel or Direct or Gmail"
}

If NO (newsletter, marketing, spam, existing project update, etc.), return: {"is_bid": false}

Return ONLY the JSON object, no other text.`;

      let bidData: { is_bid: boolean; [key: string]: unknown } = { is_bid: false };
      try {
        const aiRes = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        });
        const raw = aiRes.content[0].type === 'text' ? aiRes.content[0].text : '{}';
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) bidData = { is_bid: false, ...JSON.parse(match[0]) };
      } catch { continue; }

      if (!bidData.is_bid) { skipped++; continue; }

      const emailDate = new Date(internalDate).toISOString().split('T')[0];
      const bidRow = {
        workspace_id: workspaceId,
        thread_id: threadId,
        email_received: emailDate,
        project_name: (bidData.project_name as string) || 'Untitled Project',
        address: bidData.address as string | null,
        city: bidData.city as string | null,
        state: (bidData.state as string) || 'TX',
        gc_name: bidData.gc_name as string | null,
        // Untrusted (extracted from inbound email): validate before storing —
        // gc_email later becomes an outbound proposal recipient, and plans_link
        // is rendered as a clickable link in our own UI.
        gc_email: isValidEmail(bidData.gc_email) ? (bidData.gc_email as string).trim() : null,
        gc_contact_name: bidData.gc_contact_name as string | null,
        gc_contact_phone: bidData.gc_contact_phone as string | null,
        bid_due_date: bidData.bid_due_date as string | null,
        bid_due_time: bidData.bid_due_time as string | null,
        scope: bidData.scope as string | null,
        trades: (bidData.trades as string[]) ?? [],
        plans_link: safeHttpUrl(bidData.plans_link),
        source: (bidData.source as string) || 'Gmail',
        status: 'New',
      };

      // Insert with a fresh id, retrying on a primary-key collision so two
      // concurrent runs can't drop a bid by reusing the same generated id.
      let bidId: string | null = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = await nextBidId(serviceClient, workspaceId);
        const { error: insErr } = await serviceClient.from('bids').insert({ ...bidRow, id: candidate });
        if (!insErr) { bidId = candidate; break; }
        if (insErr.code === '23505') continue; // id already taken — regenerate
        console.error('[detect-bids] bid insert failed:', insErr.message);
        break;
      }
      if (!bidId) { skipped++; continue; }

      // Also save the email as a conversation record
      const { error: convErr } = await serviceClient.from('conversations').insert({
        workspace_id: workspaceId,
        bid_id: bidId,
        gmail_thread_id: threadId,
        subject,
        snippet: (msgData.snippet ?? '').slice(0, 500),
        direction: 'inbound',
        date: internalDate,
      });
      if (convErr) console.error('[detect-bids] conversation insert failed:', convErr.message);

      detected++;
    }

    return NextResponse.json({
      success: true,
      detected,
      skipped,
      message: detected === 0
        ? 'No new bids found in Gmail inbox.'
        : `Created ${detected} new bid${detected !== 1 ? 's' : ''} from Gmail.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Detection failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
