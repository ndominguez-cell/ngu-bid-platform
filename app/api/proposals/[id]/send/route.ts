import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser, forbidNonWriter } from '@/lib/auth';
import { enforceRateLimit, RATE_PRESETS } from '@/lib/ratelimit';
import { isValidEmail } from '@/lib/validation';
import { getValidAccessToken, gmailFetch, buildMimeMessage } from '@/lib/gmail';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const denied = forbidNonWriter(auth.role);
  if (denied) return denied;
  const user = auth.user;

  const serviceClient = createServiceClient();

  const limited = await enforceRateLimit(serviceClient, { userId: user.id, workspaceId: auth.workspaceId, route: 'proposal-send', rules: RATE_PRESETS.send });
  if (limited) return limited;

  const { data: proposal, error: propErr } = await serviceClient
    .from('proposals')
    .select('*, bids(gc_email, gc_name, project_name)')
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .single();

  if (propErr || !proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  if (proposal.status === 'Sent') return NextResponse.json({ error: 'Already sent' }, { status: 400 });

  const bid = proposal.bids as { gc_email: string | null; gc_name: string | null; project_name: string } | null;
  const toEmail = bid?.gc_email;
  // Recipient is derived from email-extracted data — validate before sending our
  // bid amounts to it.
  if (!isValidEmail(toEmail)) return NextResponse.json({ error: 'No valid recipient email on bid' }, { status: 400 });

  // Atomically claim the proposal so a double-click can't send it twice: only
  // one request will match status not in (Sent, Sending) and flip it to Sending.
  const prevStatus = proposal.status as string;
  const { data: claimed, error: claimErr } = await serviceClient
    .from('proposals')
    .update({ status: 'Sending' })
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .neq('status', 'Sent')
    .neq('status', 'Sending')
    .select('id')
    .maybeSingle();
  // If the claim errored, the 'Sending' status likely isn't in the check
  // constraint yet (migration not applied) — fall back to the non-atomic guard
  // (status !== 'Sent', already checked above) rather than block all sends.
  const claimedLock = !claimErr;
  if (!claimErr && !claimed) return NextResponse.json({ error: 'Already sending or sent' }, { status: 409 });

  try {
    const accessToken = await getValidAccessToken(user.id);

    const raw = buildMimeMessage({
      to: toEmail,
      subject: proposal.subject,
      body: proposal.body_final || proposal.body_draft || '',
    });

    const sendRes = await gmailFetch(accessToken, '/messages/send', {
      method: 'POST',
      body: JSON.stringify({ raw }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      throw new Error(`Gmail send failed: ${errText}`);
    }

    const sent = await sendRes.json();
    const threadId: string = sent.threadId ?? sent.id;
    const now = new Date().toISOString();

    await serviceClient.from('proposals').update({
      status: 'Sent',
      sent_at: now,
      sent_by: user.id,
      gmail_thread_id: threadId,
    }).eq('id', params.id).eq('workspace_id', auth.workspaceId);

    await serviceClient.from('conversations').insert({
      workspace_id: auth.workspaceId,
      bid_id: proposal.bid_id,
      gmail_thread_id: threadId,
      subject: proposal.subject,
      snippet: (proposal.body_final || proposal.body_draft || '').substring(0, 200),
      direction: 'outbound',
      date: now,
    });

    return NextResponse.json({ success: true, thread_id: threadId });
  } catch (err: unknown) {
    // Release the claim so the user can retry after a failed send (only if we
    // actually set the 'Sending' lock).
    if (claimedLock) {
      await serviceClient
        .from('proposals')
        .update({ status: prevStatus })
        .eq('id', params.id)
        .eq('workspace_id', auth.workspaceId)
        .eq('status', 'Sending');
    }
    const message = err instanceof Error ? err.message : 'Send failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
