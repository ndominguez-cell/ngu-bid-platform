import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { getValidAccessToken, gmailFetch } from '@/lib/gmail';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface GmailPart {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
}

// Fetch the plain-text body from a Gmail message payload
function extractBody(payload: GmailPart): string {
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
    // Recurse into nested multiparts, then fall back to any body
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return '';
}

// Walk the MIME tree collecting plan/spec document attachments
const DOC_MIME_TYPES = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/heic',
]);

function collectAttachments(payload: GmailPart): { filename: string; mimeType: string; attachmentId: string; size: number }[] {
  const found: { filename: string; mimeType: string; attachmentId: string; size: number }[] = [];
  function walk(part: GmailPart) {
    if (part.filename && part.body?.attachmentId && DOC_MIME_TYPES.has(part.mimeType ?? '')) {
      found.push({
        filename: part.filename,
        mimeType: part.mimeType!,
        attachmentId: part.body.attachmentId,
        size: part.body.size ?? 0,
      });
    }
    for (const child of part.parts ?? []) walk(child);
  }
  walk(payload);
  return found;
}

// Classify an attachment filename as plans / specs / addendum / other
function classifyDocument(filename: string): 'plans' | 'specs' | 'addendum' | 'other' {
  const f = filename.toLowerCase();
  if (/(addend|adden\b)/.test(f)) return 'addendum';
  if (/(spec|manual|division)/.test(f)) return 'specs';
  if (/(plan|drawing|dwg|sheet|blueprint|site|civil|c-\d|a-\d)/.test(f)) return 'plans';
  if (f.endsWith('.pdf')) return 'plans';
  return 'other';
}

// Generate next bid ID: BID-YYYY-NNN
async function nextBidId(serviceClient: ReturnType<typeof createServiceClient>, workspaceId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BID-${year}-`;
  const { data } = await serviceClient
    .from('bids')
    .select('id')
    .eq('workspace_id', workspaceId)
    .like('id', `${prefix}%`)
    .order('id', { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return `${prefix}001`;
  const last = data[0].id as string;
  const num = parseInt(last.replace(prefix, ''), 10);
  return `${prefix}${String(num + 1).padStart(3, '0')}`;
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const user = auth.user;
  const workspaceId = auth.workspaceId;

  try {
    const accessToken = await getValidAccessToken(user.id);
    const serviceClient = createServiceClient();

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
    let documentsSaved = 0;

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
        .single();
      if (existingBid) { skipped++; continue; }

      const body = extractBody(msgData.payload);
      const emailText = `From: ${fromHeader}\nSubject: ${subject}\n\n${body}`.slice(0, 4000);

      const prompt = `You analyze construction subcontractor bid invitation emails for NGU Construction (a site work and paving company in Texas).

Email:
${emailText}

Determine if this email is a genuine bid invitation asking NGU to submit a bid/quote/estimate as a subcontractor.

Extract EVERY piece of data present — especially due dates (look for "bids due", "due by", "submit by", "closes", "deadline") and any proposed/anticipated construction start date. Dates may be written many ways ("March 5th", "3/5/26", "next Friday") — normalize to YYYY-MM-DD. If a date is genuinely absent, use null; never invent one. Also look for plan room links (PlanHub, Procore, BuildingConnected, Dropbox, SharePoint, QuestCDN) anywhere in the body.

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
  "proposed_start_date": "YYYY-MM-DD or null (construction/mobilization start date if mentioned)",
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

      const bidId = await nextBidId(serviceClient, workspaceId);
      const emailDate = new Date(internalDate).toISOString().split('T')[0];

      await serviceClient.from('bids').insert({
        workspace_id: workspaceId,
        id: bidId,
        thread_id: threadId,
        email_received: emailDate,
        project_name: (bidData.project_name as string) || 'Untitled Project',
        address: bidData.address as string | null,
        city: bidData.city as string | null,
        state: (bidData.state as string) || 'TX',
        gc_name: bidData.gc_name as string | null,
        gc_email: bidData.gc_email as string | null,
        gc_contact_name: bidData.gc_contact_name as string | null,
        gc_contact_phone: bidData.gc_contact_phone as string | null,
        bid_due_date: bidData.bid_due_date as string | null,
        bid_due_time: bidData.bid_due_time as string | null,
        proposed_start_date: bidData.proposed_start_date as string | null,
        scope: bidData.scope as string | null,
        trades: (bidData.trades as string[]) ?? [],
        plans_link: bidData.plans_link as string | null,
        source: (bidData.source as string) || 'Gmail',
        status: 'New',
      });

      // Also save the email as a conversation record
      await serviceClient.from('conversations').insert({
        workspace_id: workspaceId,
        bid_id: bidId,
        gmail_thread_id: threadId,
        subject,
        snippet: (msgData.snippet ?? '').slice(0, 500),
        direction: 'inbound',
        date: internalDate,
      });

      // Extract plan/spec attachments from the email into document storage
      const attachments = collectAttachments(msgData.payload ?? {});
      for (const att of attachments) {
        try {
          const attRes = await gmailFetch(accessToken, `/messages/${msg.id}/attachments/${att.attachmentId}`);
          if (!attRes.ok) continue;
          const attData = await attRes.json();
          if (!attData.data) continue;
          const bytes = Buffer.from(attData.data, 'base64url');

          const safeName = att.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storagePath = `${workspaceId}/bids/${bidId}/${Date.now()}-${safeName}`;
          const { error: uploadError } = await serviceClient.storage
            .from('documents')
            .upload(storagePath, bytes, { contentType: att.mimeType });
          if (uploadError) continue;

          await serviceClient.from('documents').insert({
            workspace_id: workspaceId,
            bid_id: bidId,
            name: att.filename,
            type: classifyDocument(att.filename),
            storage_path: storagePath,
            file_size: bytes.length,
            mime_type: att.mimeType,
            uploaded_by: user.id,
          });
          documentsSaved++;
        } catch {
          // Skip attachments that fail — the bid itself is already created
        }
      }

      detected++;
    }

    return NextResponse.json({
      success: true,
      detected,
      skipped,
      documents_saved: documentsSaved,
      message: detected === 0
        ? 'No new bids found in Gmail inbox.'
        : `Created ${detected} new bid${detected !== 1 ? 's' : ''} from Gmail${documentsSaved > 0 ? ` and saved ${documentsSaved} plan document${documentsSaved !== 1 ? 's' : ''}` : ''}.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Detection failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
