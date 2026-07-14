import type { createServiceClient } from '@/lib/supabase/server';
import { safeHttpUrl, isValidEmail, cleanString } from '@/lib/validation';

export const BID_STATUSES = ['New', 'Reviewing', 'Active', 'Submitted', 'Won', 'Lost', 'Declined', 'Expired'];

// Build a bids row from request/LLM input using an explicit allowlist. Never
// spread the raw body — that would let a client set id, workspace_id,
// created_at, or a dangling company_id/contact_id.
export function pickBidFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const strFields = ['thread_id', 'project_name', 'address', 'city', 'state', 'gc_name', 'gc_contact_name', 'gc_contact_phone', 'bid_due_time', 'submit_to', 'scope', 'source', 'notes'];
  for (const f of strFields) if (f in body) out[f] = cleanString(body[f]);

  if ('gc_email' in body) out.gc_email = isValidEmail(body.gc_email) ? (body.gc_email as string).trim() : null;
  if ('plans_link' in body) out.plans_link = safeHttpUrl(body.plans_link);
  if ('email_received' in body) out.email_received = cleanString(body.email_received, 40);
  if ('bid_due_date' in body) out.bid_due_date = cleanString(body.bid_due_date, 40);
  if ('trades' in body) out.trades = Array.isArray(body.trades) ? (body.trades as unknown[]).map(t => cleanString(t, 60)).filter(Boolean) : [];
  if ('status' in body && BID_STATUSES.includes(body.status as string)) out.status = body.status;
  if ('our_bid_amount' in body) out.our_bid_amount = typeof body.our_bid_amount === 'number' ? body.our_bid_amount : null;
  if ('awarded_amount' in body) out.awarded_amount = typeof body.awarded_amount === 'number' ? body.awarded_amount : null;
  return out;
}

// Only accept a company_id / contact_id that belongs to the caller's workspace.
export async function validateBidRefs(
  supabase: ReturnType<typeof createServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
  out: Record<string, unknown>
): Promise<string | null> {
  for (const [field, table] of [['company_id', 'companies'], ['contact_id', 'contacts']] as const) {
    if (!(field in body)) continue;
    const val = body[field];
    if (val == null) { out[field] = null; continue; }
    if (typeof val !== 'string') return `Invalid ${field}`;
    const { data } = await supabase.from(table).select('id').eq('id', val).eq('workspace_id', workspaceId).maybeSingle();
    if (!data) return `${field} is not in your workspace`;
    out[field] = val;
  }
  return null;
}
