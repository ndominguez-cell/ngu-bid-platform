import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { formatDate, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, Paperclip, ExternalLink, FileText, Calendar, Building2, MapPin, Send } from 'lucide-react';
import ProposalSendButton from './ProposalSendButton';
import ProposalRedraftButton from './ProposalRedraftButton';
import { AIPill } from '@/components/ui/AIPill';

export const revalidate = 0;

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Draft:    { bg: 'var(--surface-2)', color: 'var(--text-muted)' },
  Reviewed: { bg: 'var(--warn-soft)', color: 'var(--warn)' },
  Sent:     { bg: 'var(--ok-soft)',   color: 'var(--ok)' },
  Declined: { bg: 'var(--bad-soft)',  color: 'var(--bad)' },
};

export default async function ProposalDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('proposals')
    .select('*, bids(project_name, gc_name, gc_email, bid_due_date, city, state, trades, our_bid_amount), estimates(id, name, total_amount, markup_pct)')
    .eq('id', params.id)
    .single();

  if (error || !data) notFound();

  const p = data as any;
  const statusStyle = STATUS_STYLES[p.status] ?? STATUS_STYLES.Draft;
  const bodyText = p.body_final || p.body_draft || '';
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back nav */}
      <Link
        href="/proposals"
        className="inline-flex items-center gap-1.5 text-[13px] mb-5 transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={13} />
        Proposals
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded"
              style={{ background: statusStyle.bg, color: statusStyle.color }}
            >
              {p.status}
            </span>
            {p.body_draft && <AIPill>AI-Generated</AIPill>}
            <span className="text-[12px]" style={{ color: 'var(--text-subtle)' }}>
              {formatDate(p.created_at)}
            </span>
          </div>
          <h1 className="text-[22px] font-semibold leading-tight" style={{ color: 'var(--text)' }}>
            {p.subject}
          </h1>
          {p.bids && (
            <div className="mt-1.5 flex items-center gap-3 text-[13px]" style={{ color: 'var(--text-muted)' }}>
              <Link
                href={`/bids/${p.bid_id}`}
                className="font-medium transition-colors hover:opacity-80"
                style={{ color: 'var(--orange)' }}
              >
                {p.bids.project_name}
              </Link>
              {p.bids.gc_name && (
                <span className="flex items-center gap-1">
                  <Building2 size={12} /> {p.bids.gc_name}
                </span>
              )}
              {(p.bids.city || p.bids.state) && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {[p.bids.city, p.bids.state].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <ProposalSendButton
            proposalId={p.id}
            gcEmail={p.bids?.gc_email ?? null}
            status={p.status}
          />
        </div>
      </div>

      {/* Main layout: email compose + right panel */}
      <div className="grid grid-cols-3 gap-5">
        {/* Email compose (2/3) */}
        <div className="col-span-2 space-y-4">
          {/* Preview */}
          <div className="card overflow-hidden p-0">
            <div className="card-head flex items-center justify-between">
              <h2 className="card-title">Proposal Email</h2>
              <span className="mono text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                {wordCount} words
              </span>
            </div>

            {/* Header fields */}
            <div className="px-5 py-3 space-y-2 text-[13px]" style={{ borderBottom: '1px solid var(--border)' }}>
              {[
                { label: 'TO', value: p.bids?.gc_email || p.bids?.gc_name || '—' },
                { label: 'CC', value: '' },
                { label: 'SUBJECT', value: p.subject },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="label-mono w-14 shrink-0">{label}</span>
                  <span style={{ color: 'var(--text)' }}>{value || <span style={{ color: 'var(--text-subtle)' }}>—</span>}</span>
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              {bodyText ? (
                <pre
                  className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed"
                  style={{ color: 'var(--text)' }}
                >
                  {bodyText}
                </pre>
              ) : (
                <p className="text-[13px] italic" style={{ color: 'var(--text-subtle)' }}>No content yet</p>
              )}
            </div>
          </div>

          {/* Attachments */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="card-title">Attachments</h2>
              <button className="btn btn-ghost btn-sm flex items-center gap-1.5">
                <Paperclip size={12} />
                Attach File
              </button>
            </div>
            <p className="text-[12px]" style={{ color: 'var(--text-subtle)' }}>No attachments</p>
          </div>
        </div>

        {/* Right panel (1/3) */}
        <div className="space-y-4">
          {/* AI Controls */}
          <div
            className="card p-4"
            style={{
              background: 'linear-gradient(135deg, var(--navy-soft) 0%, var(--info-soft) 100%)',
            }}
          >
            <h2 className="card-title mb-3">AI Controls</h2>
            <p className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
              Re-generate a fresh draft based on the latest bid data and estimate.
            </p>
            <ProposalRedraftButton bidId={p.bid_id} estimateId={p.estimate_id ?? null} />
            <div className="mt-3 space-y-2">
              <button className="btn btn-ghost btn-sm w-full text-left">Adjust Tone → Professional</button>
              <button className="btn btn-ghost btn-sm w-full text-left">Adjust Tone → Friendly</button>
              <button className="btn btn-ghost btn-sm w-full text-left">Shorten</button>
            </div>
          </div>

          {/* Bid Summary */}
          {p.bids && (
            <div className="card p-4">
              <h2 className="card-title mb-3">Bid Summary</h2>
              <div className="space-y-3 text-[13px]">
                <div>
                  <p className="label-mono mb-0.5">Project</p>
                  <p style={{ color: 'var(--text)' }}>{p.bids.project_name}</p>
                </div>
                {p.bids.gc_name && (
                  <div>
                    <p className="label-mono mb-0.5">GC</p>
                    <p style={{ color: 'var(--text)' }}>{p.bids.gc_name}</p>
                  </div>
                )}
                {p.bids.gc_email && (
                  <div>
                    <p className="label-mono mb-0.5">Send To</p>
                    <p className="mono text-[12px]" style={{ color: 'var(--text)' }}>{p.bids.gc_email}</p>
                  </div>
                )}
                {p.bids.bid_due_date && (
                  <div>
                    <p className="label-mono mb-0.5">Bid Due</p>
                    <p style={{ color: 'var(--text)' }}>{formatDate(p.bids.bid_due_date)}</p>
                  </div>
                )}
                {p.bids.our_bid_amount != null && (
                  <div>
                    <p className="label-mono mb-0.5">Bid Amount</p>
                    <p className="mono font-semibold" style={{ color: 'var(--navy)' }}>
                      {formatCurrency(p.bids.our_bid_amount)}
                    </p>
                  </div>
                )}
                {p.bids.trades && p.bids.trades.length > 0 && (
                  <div>
                    <p className="label-mono mb-1">Trades</p>
                    <div className="flex flex-wrap gap-1">
                      {p.bids.trades.slice(0, 5).map((t: string) => (
                        <span
                          key={t}
                          className="inline-flex items-center rounded px-2 py-0.5 text-[10.5px] font-medium"
                          style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}
                        >
                          {t}
                        </span>
                      ))}
                      {p.bids.trades.length > 5 && (
                        <span className="text-[10.5px]" style={{ color: 'var(--text-subtle)' }}>
                          +{p.bids.trades.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {p.sent_at && (
                  <div>
                    <p className="label-mono mb-0.5">Sent</p>
                    <p style={{ color: 'var(--text)' }}>{formatDate(p.sent_at)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Linked estimate */}
          {p.estimates && (
            <div className="card p-4">
              <h2 className="card-title mb-3">Linked Estimate</h2>
              <Link
                href={`/estimates/${p.estimates.id}`}
                className="flex items-center justify-between rounded px-3 py-2.5 transition-colors hover:bg-[var(--surface-3)]"
                style={{ background: 'var(--surface-2)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="grid h-7 w-7 shrink-0 place-items-center rounded"
                    style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}
                  >
                    <FileText size={13} />
                  </div>
                  <div>
                    <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{p.estimates.name}</div>
                    {p.estimates.total_amount != null && (
                      <div className="mono text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        {formatCurrency(p.estimates.total_amount)}
                        {p.estimates.markup_pct != null && ` · ${p.estimates.markup_pct}% markup`}
                      </div>
                    )}
                  </div>
                </div>
                <ExternalLink size={13} style={{ color: 'var(--text-subtle)' }} />
              </Link>
            </div>
          )}

          {/* Quick actions */}
          <div className="card p-4 space-y-2">
            <ProposalSendButton
              proposalId={p.id}
              gcEmail={p.bids?.gc_email ?? null}
              status={p.status}
            />
            {p.bid_id && (
              <Link
                href={`/bids/${p.bid_id}`}
                className="btn btn-ghost btn-sm w-full flex items-center justify-center gap-1.5"
              >
                View Bid
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
