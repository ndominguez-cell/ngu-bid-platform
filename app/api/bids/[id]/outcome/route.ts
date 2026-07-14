import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';

// Dedicated, validated endpoint for the win/loss feedback signal.
// Kept separate from the generic PATCH so the outcome data stays clean:
// it whitelists fields, sets decided_at, and writes an audit-log row.
const OUTCOMES = ['Won', 'Lost', 'Declined'] as const;
type Outcome = (typeof OUTCOMES)[number];

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const outcome = body.outcome as Outcome;
  if (!OUTCOMES.includes(outcome)) {
    return NextResponse.json({ error: 'Invalid outcome (expected Won, Lost, or Declined)' }, { status: 400 });
  }

  const our_bid_amount = outcome === 'Declined' ? null : num(body.our_bid_amount);
  const awarded_amount = outcome === 'Declined' ? null : num(body.awarded_amount);
  const loss_reason =
    outcome === 'Won'
      ? null
      : typeof body.loss_reason === 'string' && body.loss_reason.trim()
        ? body.loss_reason.trim().slice(0, 200)
        : null;

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // Scope strictly to the caller's workspace — never trust the id alone.
  const { data: bid, error: updateError } = await supabase
    .from('bids')
    .update({
      status: outcome,
      our_bid_amount,
      awarded_amount,
      loss_reason,
      decided_at: now,
      updated_at: now,
    })
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .select()
    .single();

  if (updateError || !bid) {
    return NextResponse.json({ error: updateError?.message ?? 'Bid not found' }, { status: 404 });
  }

  // Append to the activity log so the feedback signal has an audit trail.
  await supabase.from('bid_activity').insert({
    workspace_id: auth.workspaceId,
    bid_id: params.id,
    user_id: auth.user.id,
    type: 'status_change',
    content: `Outcome recorded: ${outcome}${loss_reason ? ` — ${loss_reason}` : ''}`,
    metadata: { outcome, our_bid_amount, awarded_amount, loss_reason },
  });

  return NextResponse.json({ data: bid });
}
