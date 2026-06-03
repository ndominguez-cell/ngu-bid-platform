import { createClient } from '@/lib/supabase/server';
import { formatDate, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Plus, Calculator } from 'lucide-react';

export const revalidate = 0;

const EST_STATUS: Record<string, { bg: string; color: string }> = {
  Draft:       { bg: 'var(--surface-2)',  color: 'var(--text-muted)' },
  'In Review': { bg: 'var(--info-soft)',  color: 'var(--info)' },
  Approved:    { bg: 'var(--ok-soft)',    color: 'var(--ok)' },
  Submitted:   { bg: 'var(--warn-soft)',  color: 'var(--warn)' },
  Archived:    { bg: 'var(--surface-2)',  color: 'var(--text-subtle)' },
};

export default async function EstimatesPage() {
  const supabase = createClient();
  const { data: estimates } = await supabase
    .from('estimates')
    .select('*, bids(project_name, city, state)')
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto w-full max-w-[1480px] px-7 pb-20 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-medium leading-tight" style={{ color: 'var(--text)' }}>Estimates</h1>
          <p className="text-[13.5px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Upload plans · AI takeoff · Build line items
          </p>
        </div>
        <Link href="/estimates/new" className="btn btn-accent btn-sm flex items-center gap-1.5">
          <Plus size={13} /> New Estimate
        </Link>
      </div>

      {/* Empty state */}
      {(!estimates || estimates.length === 0) && (
        <div
          className="rounded-lg p-12 text-center mb-6"
          style={{ border: '2px dashed var(--border)' }}
        >
          <Calculator size={36} className="mx-auto mb-4" style={{ color: 'var(--border-strong)' }} />
          <h2 className="text-[15px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>No estimates yet</h2>
          <p className="text-[13px] mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-subtle)' }}>
            Upload plans or specs for a bid and Claude will analyze them to generate a takeoff and line-item estimate.
          </p>
          <Link href="/estimates/new" className="btn btn-primary flex items-center gap-1.5 inline-flex">
            <Plus size={14} /> Upload Your First Plans
          </Link>
        </div>
      )}

      {/* Table */}
      {estimates && estimates.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Estimate', 'Project', 'Total', 'Status', 'Created'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 label-mono">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estimates.map((est: any) => {
                const s = EST_STATUS[est.status] ?? EST_STATUS.Draft;
                return (
                  <tr
                    key={est.id}
                    className="transition-colors hover:bg-[var(--surface-2)]"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/estimates/${est.id}`}
                        className="font-semibold transition-colors hover:text-[var(--orange)]"
                        style={{ color: 'var(--navy)' }}
                      >
                        {est.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--text-2)' }}>
                      {est.bids?.project_name || '—'}
                      {est.bids?.city && (
                        <span style={{ color: 'var(--text-subtle)' }}> · {est.bids.city}, {est.bids.state}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--navy)' }}>
                      {formatCurrency(est.total_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded"
                        style={{ background: s.bg, color: s.color }}
                      >
                        {est.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--text-subtle)' }}>
                      {formatDate(est.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
