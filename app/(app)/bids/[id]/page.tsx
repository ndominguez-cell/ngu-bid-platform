import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatCurrency, getDaysLeft } from '@/lib/utils';
import type { Bid, Conversation, Estimate, Proposal } from '@/lib/types';
import {
  ArrowLeft, ExternalLink, Mail, MapPin, Building2, Calendar, Send,
  Sparkles, Plus, FileText,
} from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { UrgencyBadge } from '@/components/ui/UrgencyBadge';
import { SourcePill } from '@/components/ui/SourcePill';
import { AIPill } from '@/components/ui/AIPill';
import BidStatusUpdater from './BidStatusUpdater';
import FindPlansButton from './FindPlansButton';

export const revalidate = 0;

type BidWithRels = Bid & { estimates?: Estimate[]; proposals?: Proposal[] };

export default async function BidDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data, error }, { data: conversations }] = await Promise.all([
    supabase.from('bids').select('*, estimates(*), proposals(*)').eq('id', params.id).single(),
    supabase.from('conversations').select('*').eq('bid_id', params.id).order('date', { ascending: false }),
  ]);

  if (error || !data) notFound();
  const bid = data as BidWithRels;
  const convs = (conversations ?? []) as Conversation[];
  const days = getDaysLeft(bid.bid_due_date);

  const estimates = bid.estimates ?? [];
  const proposals = bid.proposals ?? [];
  const latestEstimate = estimates[0];

  return (
    <div className="mx-auto w-full max-w-[1480px] px-7 pb-20 pt-6">
      {/* Back row */}
      <div className="mb-3.5 flex items-center gap-2">
        <Link href="/bids" className="btn btn-ghost btn-sm">
          <ArrowLeft size={13} /> Back to Bids
        </Link>
        <span className="mono text-[11px]" style={{ color: 'var(--text-subtle)' }}>
          / {bid.id}
        </span>
      </div>

      {/* Hero */}
      <section
        className="rounded-md border p-7"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SourcePill source={bid.source} />
              <span className="mono text-[11px]" style={{ color: 'var(--text-subtle)' }}>{bid.id}</span>
              <StatusPill status={bid.status} />
              <UrgencyBadge days={days} />
            </div>

            <h1
              className="mt-2 text-[26px] font-medium leading-snug tracking-tight"
              style={{ color: 'var(--text)' }}
            >
              {bid.project_name}
            </h1>

            <div
              className="mt-1.5 flex flex-wrap items-center gap-4 text-[13px]"
              style={{ color: 'var(--text-muted)' }}
            >
              {([bid.address, bid.city, bid.state].filter(Boolean).length > 0) && (
                <MetaItem icon={<MapPin size={13} />}>
                  {[bid.address, bid.city, bid.state].filter(Boolean).join(', ')}
                </MetaItem>
              )}
              {bid.gc_name && <MetaItem icon={<Building2 size={13} />}>{bid.gc_name}</MetaItem>}
              {bid.bid_due_date && (
                <MetaItem icon={<Calendar size={13} />}>
                  Due {formatDate(bid.bid_due_date)}
                  {bid.bid_due_time && <span className="mono"> · {bid.bid_due_time}</span>}
                </MetaItem>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {bid.plans_link && (
              <a href={bid.plans_link} target="_blank" rel="noopener noreferrer" className="btn">
                <ExternalLink size={14} /> View Plans
              </a>
            )}
            {bid.thread_id && (
              <a
                href={`https://mail.google.com/mail/u/0/#inbox/${bid.thread_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
              >
                <Mail size={14} /> Gmail Thread
              </a>
            )}
            <button className="btn btn-accent">
              <Send size={14} /> Submit Bid
            </button>
          </div>
        </div>

        <div
          className="mt-6 grid grid-cols-2 gap-6 border-t pt-6 md:grid-cols-4"
          style={{ borderTop: '1px dashed var(--border)' }}
        >
          <Detail label="Submit To"      value={bid.submit_to ?? '—'} mono />
          <Detail label="GC Contact"     value={bid.gc_contact_name ?? '—'} extra={bid.gc_contact_phone} />
          <Detail label="Email Received" value={formatDate(bid.email_received)} />
          <Detail
            label="Our Bid Amount"
            value={bid.our_bid_amount != null ? formatCurrency(bid.our_bid_amount) : 'Pending'}
            valueColor="var(--orange-ink)"
            valueSize={18}
          />
        </div>
      </section>

      {/* AI summary + status updater */}
      <div className="mt-[18px] grid grid-cols-1 lg:grid-cols-12 gap-4">
        {latestEstimate?.ai_summary && (
          <div className="lg:col-span-8">
            <AISummaryBox summary={latestEstimate.ai_summary} />
          </div>
        )}
        <div className={`card ${latestEstimate?.ai_summary ? 'lg:col-span-4' : 'lg:col-span-12'} p-0`}>
          <div className="card-head">
            <div className="card-title">Update Status</div>
          </div>
          <div className="p-3.5">
            <BidStatusUpdater bidId={bid.id} currentStatus={bid.status} />
          </div>
        </div>
      </div>

      {/* Scope + financials */}
      <div className="mt-[18px] grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="card lg:col-span-8">
          <div className="card-head"><div className="card-title">Scope</div></div>
          <div className="p-[18px]">
            {bid.scope ? (
              <p className="m-0 text-[14px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{bid.scope}</p>
            ) : (
              <p className="m-0 text-[13px]" style={{ color: 'var(--text-subtle)' }}>No scope summary yet.</p>
            )}
            {bid.trades && bid.trades.length > 0 && (
              <div
                className="mt-5 border-t pt-5"
                style={{ borderTop: '1px dashed var(--border)' }}
              >
                <div className="label-mono mb-2.5">Trades · {bid.trades.length}</div>
                <div className="flex flex-wrap gap-1.5">
                  {bid.trades.map(t => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded px-2.5 py-1 text-[12px] font-medium"
                      style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card lg:col-span-4">
          <div className="card-head"><div className="card-title">Financials</div></div>
          <div className="space-y-4 p-[18px]">
            <FinancialRow
              label="Our Bid"
              value={bid.our_bid_amount != null ? formatCurrency(bid.our_bid_amount) : 'Pending estimate'}
              dim={bid.our_bid_amount == null}
              size={22}
            />
            <FinancialRow
              label="Awarded"
              value={bid.awarded_amount != null ? formatCurrency(bid.awarded_amount) : '—'}
              dim={bid.awarded_amount == null}
              size={16}
            />
            {latestEstimate?.total_amount != null && (
              <FinancialRow
                label="Latest Estimate"
                value={formatCurrency(latestEstimate.total_amount)}
                sub={`${latestEstimate.markup_pct}% markup applied`}
                size={16}
              />
            )}
          </div>
        </div>
      </div>

      {/* Email history + Estimates + Proposals */}
      <div className="mt-[18px] grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="card lg:col-span-7">
          <div className="card-head">
            <div className="card-title inline-flex items-center gap-2"><Mail size={14} /> Email History</div>
            <span className="label-mono">{convs.length} threads</span>
          </div>
          <div className="p-3.5">
            {convs.length === 0 ? (
              <div className="px-2 py-8 text-center text-[13px]" style={{ color: 'var(--text-subtle)' }}>
                No email correspondence yet.
              </div>
            ) : (
              <div className="space-y-2">
                {convs.map(c => (
                  <div
                    key={c.id}
                    className="flex items-start gap-3 rounded border p-3 transition-colors hover:border-[var(--border-strong)]"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <span
                      className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider"
                      style={
                        c.direction === 'outbound'
                          ? { background: 'var(--orange-soft)', color: 'var(--orange-ink)' }
                          : { background: 'var(--info-soft)', color: 'var(--info)' }
                      }
                    >
                      {c.direction === 'outbound' ? 'Sent' : 'Recv'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-[13px] font-medium"
                        style={{ color: 'var(--text)' }}
                      >
                        {c.subject ?? '(no subject)'}
                      </div>
                      {c.snippet && (
                        <div
                          className="mt-0.5 truncate text-[12px]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {c.snippet}
                        </div>
                      )}
                    </div>
                    <span
                      className="mono shrink-0 text-[11px]"
                      style={{ color: 'var(--text-subtle)' }}
                    >
                      {c.date ? formatDate(c.date, 'MMM d') : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-5">
          {/* Estimates */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Estimates</div>
              <Link href={`/estimates/new?bid=${bid.id}`} className="btn btn-sm btn-accent">
                <Plus size={12} /> New Estimate
              </Link>
            </div>
            <div className="p-3.5">
              {estimates.length === 0 ? (
                <div className="py-3 text-center">
                  <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    No estimates yet — upload plans to create one
                  </p>
                  <div className="mt-3">
                    <FindPlansButton bidId={bid.id} hasPlansLink={!!bid.plans_link} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {estimates.map(e => (
                    <Link
                      key={e.id}
                      href={`/estimates/${e.id}`}
                      className="flex items-start gap-3 rounded border p-3 transition-colors hover:border-[var(--border-strong)]"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <div
                        className="grid h-8 w-8 shrink-0 place-items-center rounded"
                        style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}
                      >
                        <FileText size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{e.name}</div>
                        <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                          {(e.line_items?.length ?? 0)} line items · {e.markup_pct}% markup
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="mono text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                          {e.total_amount != null ? formatCurrency(e.total_amount) : '—'}
                        </div>
                        <span className="tag tag-warn mt-1"><span className="dot" />{e.status}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Proposals */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Proposals</div>
              <Link href={`/proposals/new?bid=${bid.id}`} className="btn btn-sm">
                <Sparkles size={12} /> Draft with AI
              </Link>
            </div>
            <div className="p-3.5">
              {proposals.length === 0 ? (
                <p className="px-2 py-3 text-[13px]" style={{ color: 'var(--text-subtle)' }}>
                  No proposals yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {proposals.map(p => (
                    <Link
                      key={p.id}
                      href={`/proposals/${p.id}`}
                      className="flex items-start gap-3 rounded border p-3 transition-colors hover:border-[var(--border-strong)]"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <div
                        className="grid h-8 w-8 shrink-0 place-items-center rounded"
                        style={{ background: 'var(--orange-soft)', color: 'var(--orange-ink)' }}
                      >
                        <Send size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{p.subject}</div>
                        <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                          {p.sent_at ? `Sent ${formatDate(p.sent_at, 'MMM d')}` : 'AI-drafted'}
                        </div>
                      </div>
                      <span className="tag mt-0.5"><span className="dot" />{p.status}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Sub-components
   ============================================================ */

function MetaItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span style={{ color: 'var(--text-subtle)' }}>{icon}</span>
      {children}
    </span>
  );
}

function Detail({
  label, value, extra, mono, valueColor, valueSize,
}: {
  label: string;
  value: string;
  extra?: string | null;
  mono?: boolean;
  valueColor?: string;
  valueSize?: number;
}) {
  return (
    <div>
      <div className="label-mono">{label}</div>
      <div
        className={`mt-1.5 font-medium ${mono ? 'mono' : ''}`}
        style={{
          color: valueColor ?? 'var(--text)',
          fontSize: valueSize ?? 14,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </div>
      {extra && (
        <div className="mono mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {extra}
        </div>
      )}
    </div>
  );
}

function FinancialRow({
  label, value, sub, dim, size,
}: {
  label: string;
  value: string;
  sub?: string;
  dim?: boolean;
  size?: number;
}) {
  return (
    <div>
      <div className="label-mono">{label}</div>
      <div
        className="mono mt-1 font-medium"
        style={{
          fontSize: size ?? 16,
          color: dim ? 'var(--text-subtle)' : 'var(--text)',
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function AISummaryBox({ summary }: { summary: string }) {
  return (
    <div
      className="rounded border p-4"
      style={{
        background:
          'linear-gradient(135deg, oklch(0.98 0.02 290) 0%, oklch(0.98 0.02 50) 100%)',
        borderColor: 'oklch(0.90 0.04 290)',
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <AIPill>AI Plan Analysis</AIPill>
        <span className="label-mono ml-auto">Updated · just now</span>
      </div>
      <p className="m-0 text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{summary}</p>
    </div>
  );
}
