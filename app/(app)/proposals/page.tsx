import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Send, FileText, CheckCircle2 } from 'lucide-react';

export const revalidate = 0;

const PROP_STATUS: Record<string, { bg: string; color: string }> = {
  Draft:    { bg: 'var(--surface-2)', color: 'var(--text-muted)' },
  Reviewed: { bg: 'var(--warn-soft)', color: 'var(--warn)' },
  Sent:     { bg: 'var(--ok-soft)',   color: 'var(--ok)' },
  Declined: { bg: 'var(--bad-soft)',  color: 'var(--bad)' },
};

export default async function ProposalsPage() {
  const supabase = createClient();
  const { data: proposals } = await supabase
    .from('proposals')
    .select('*, bids(project_name, gc_name, gc_email)')
    .order('created_at', { ascending: false });

  const counts = {
    Draft:    proposals?.filter(p => p.status === 'Draft').length    ?? 0,
    Reviewed: proposals?.filter(p => p.status === 'Reviewed').length ?? 0,
    Sent:     proposals?.filter(p => p.status === 'Sent').length     ?? 0,
  };

  return (
    <div className="mx-auto w-full max-w-[1480px] px-7 pb-20 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-medium leading-tight" style={{ color: 'var(--text)' }}>Proposals</h1>
          <p className="text-[13.5px] mt-1" style={{ color: 'var(--text-muted)' }}>AI-drafted · You review · Send via Gmail</p>
        </div>
        <Link href="/proposals/new" className="btn btn-accent btn-sm flex items-center gap-1.5">
          <Send size={13} /> Draft Proposal
        </Link>
      </div>

      {/* Status KPI tiles */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {([
          { label: 'Drafts',       count: counts.Draft,    icon: FileText,    accent: 'var(--border-strong)' },
          { label: 'Ready to Send',count: counts.Reviewed, icon: CheckCircle2,accent: 'var(--warn)' },
          { label: 'Sent',         count: counts.Sent,     icon: Send,        accent: 'var(--ok)' },
        ] as const).map(({ label, count, icon: Icon, accent }) => (
          <div key={label} className="card p-5" style={{ borderTop: `3px solid ${accent}` }}>
            <div className="text-[28px] font-bold" style={{ color: accent }}>{count}</div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mt-1" style={{ color: 'var(--text-subtle)' }}>
              <Icon size={11} /> {label}
            </div>
          </div>
        ))}
      </div>

      {/* Proposals list */}
      <div className="card overflow-hidden p-0">
        <div className="card-head">
          <h2 className="card-title">All Proposals</h2>
        </div>
        {(!proposals || proposals.length === 0) ? (
          <div className="p-12 text-center">
            <Send size={32} className="mx-auto mb-3" style={{ color: 'var(--border-strong)' }} />
            <p className="font-medium text-[13px] mb-1" style={{ color: 'var(--text-muted)' }}>No proposals yet</p>
            <p className="text-[12px] max-w-sm mx-auto mb-4" style={{ color: 'var(--text-subtle)' }}>
              Select a bid, choose an estimate, and Claude will draft a professional proposal email ready for your review.
            </p>
            <Link href="/proposals/new" className="btn btn-primary btn-sm inline-flex">
              Draft Your First Proposal
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {proposals.map((p: any) => {
              const s = PROP_STATUS[p.status] ?? PROP_STATUS.Draft;
              return (
                <Link
                  key={p.id}
                  href={`/proposals/${p.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text)' }}>{p.subject}</div>
                    <div className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                      {p.bids?.project_name} · {p.bids?.gc_name || p.bids?.gc_email || '—'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {p.status}
                    </span>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-subtle)' }}>
                      {formatDate(p.created_at)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
