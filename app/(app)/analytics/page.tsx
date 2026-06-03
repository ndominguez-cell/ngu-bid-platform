import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import type { Bid } from '@/lib/types';
import { TrendingUp, Award, DollarSign, Target, BarChart2 } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { SourcePill } from '@/components/ui/SourcePill';

export const revalidate = 0;

function pct(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

export default async function AnalyticsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('bids')
    .select('*')
    .order('created_at', { ascending: true });
  const bids = (data ?? []) as Bid[];

  const won       = bids.filter(b => b.status === 'Won');
  const lost      = bids.filter(b => b.status === 'Lost');
  const active    = bids.filter(b => ['New', 'Reviewing', 'Active'].includes(b.status));
  const submitted = bids.filter(b => b.status === 'Submitted');

  const winRate       = pct(won.length, won.length + lost.length);
  const totalBidValue = bids.reduce((s, b) => s + (b.our_bid_amount ?? 0), 0);
  const wonValue      = won.reduce((s, b) => s + (b.awarded_amount ?? b.our_bid_amount ?? 0), 0);
  const activePipeline = active.reduce((s, b) => s + (b.our_bid_amount ?? 0), 0);
  const bidsWithAmt   = bids.filter(b => b.our_bid_amount);
  const avgBid        = bidsWithAmt.length ? totalBidValue / bidsWithAmt.length : 0;

  const sources = ['PlanHub', 'Procore', 'Novel', 'Direct', 'Gmail'];
  const bySource = sources.map(src => {
    const g = bids.filter(b => b.source === src);
    const wg = g.filter(b => b.status === 'Won');
    const lg = g.filter(b => b.status === 'Lost');
    return { source: src, total: g.length, won: wg.length, lost: lg.length, winRate: pct(wg.length, wg.length + lg.length) };
  }).filter(s => s.total > 0);

  const statusOrder: Bid['status'][] = ['New', 'Reviewing', 'Active', 'Submitted', 'Won', 'Lost', 'Declined', 'Expired'];
  const byStatus = statusOrder.map(st => ({ status: st, count: bids.filter(b => b.status === st).length })).filter(s => s.count > 0);

  const now = new Date();
  const months: { label: string; bids: number; won: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const mb = bids.filter(b => {
      const bd = b.bid_due_date ?? b.created_at;
      const bdate = new Date(bd);
      return bdate.getFullYear() === d.getFullYear() && bdate.getMonth() === d.getMonth();
    });
    months.push({ label, bids: mb.length, won: mb.filter(b => b.status === 'Won').length });
  }
  const maxMonthBids = Math.max(...months.map(m => m.bids), 1);

  const tradeCounts: Record<string, { total: number; won: number }> = {};
  for (const b of bids) {
    for (const t of b.trades ?? []) {
      if (!tradeCounts[t]) tradeCounts[t] = { total: 0, won: 0 };
      tradeCounts[t].total++;
      if (b.status === 'Won') tradeCounts[t].won++;
    }
  }
  const topTrades = Object.entries(tradeCounts).sort((a, b) => b[1].total - a[1].total).slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-[1480px] px-7 pb-20 pt-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[28px] font-medium leading-tight" style={{ color: 'var(--text)' }}>Analytics</h1>
        <p className="text-[13.5px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Win/loss performance across {bids.length} bids
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Win Rate"
          value={`${winRate}%`}
          sub={`${won.length}W / ${lost.length}L`}
          icon={<Target size={16} />}
          accentColor={winRate >= 50 ? 'var(--ok)' : 'var(--bad)'}
        />
        <KpiCard
          label="Total Won"
          value={formatCurrency(wonValue)}
          sub={`${won.length} won bids`}
          icon={<Award size={16} />}
          accentColor="var(--ok)"
        />
        <KpiCard
          label="Active Pipeline"
          value={formatCurrency(activePipeline)}
          sub={`${active.length} active · ${submitted.length} submitted`}
          icon={<TrendingUp size={16} />}
          accentColor="var(--orange)"
        />
        <KpiCard
          label="Avg Bid Amount"
          value={formatCurrency(avgBid)}
          sub={`${bidsWithAmt.length} bids with amounts`}
          icon={<DollarSign size={16} />}
          accentColor="var(--navy)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Monthly trend */}
        <div className="card lg:col-span-2">
          <div className="card-head">
            <div className="flex items-center gap-1.5 card-title">
              <BarChart2 size={14} /> Monthly Bid Activity
            </div>
            <span className="label-mono">Last 12 months</span>
          </div>
          <div className="px-5 pb-5 pt-4">
            <div className="flex items-end gap-1.5 h-28">
              {months.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end" style={{ height: 80 }}>
                    {m.bids > 0 ? (
                      <div
                        className="w-full rounded-t-sm relative group"
                        style={{ height: `${Math.round((m.bids / maxMonthBids) * 80)}px`, background: 'var(--navy)' }}
                      >
                        {m.won > 0 && (
                          <div
                            className="absolute bottom-0 left-0 w-full rounded-t-sm"
                            style={{ height: `${Math.round((m.won / m.bids) * 100)}%`, background: 'var(--ok)' }}
                          />
                        )}
                        <div
                          className="absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
                          style={{ background: 'var(--text)', color: 'var(--bg)' }}
                        >
                          {m.bids} bids · {m.won} won
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-0.5" style={{ background: 'var(--border)', marginTop: 'auto' }} />
                    )}
                  </div>
                  <span className="text-[9px] font-medium" style={{ color: 'var(--text-subtle)' }}>{m.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--navy)' }} /> Total bids
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--ok)' }} /> Won
              </span>
            </div>
          </div>
        </div>

        {/* Status breakdown */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Status Breakdown</div>
          </div>
          <div className="p-4 space-y-3">
            {byStatus.map(({ status, count }) => (
              <div key={status}>
                <div className="flex items-center justify-between mb-1.5">
                  <StatusPill status={status as Bid['status']} />
                  <span className="mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {count} <span style={{ color: 'var(--text-subtle)' }}>({pct(count, bids.length)}%)</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct(count, bids.length)}%`, background: 'var(--navy)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* By source */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Win Rate by Source</div>
          </div>
          <div className="p-4">
            {bySource.length === 0 ? (
              <p className="text-[13px] py-4 text-center" style={{ color: 'var(--text-subtle)' }}>No source data yet</p>
            ) : (
              <div className="space-y-3">
                {bySource.map(({ source, total, won: w, winRate: wr }) => (
                  <div key={source} className="flex items-center gap-3">
                    <div className="shrink-0">
                      <SourcePill source={source} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[12px] mb-1">
                        <span style={{ color: 'var(--text-muted)' }}>{total} bids · {w} won</span>
                        <span
                          className="font-semibold"
                          style={{ color: wr >= 50 ? 'var(--ok)' : wr > 0 ? 'var(--orange)' : 'var(--text-subtle)' }}
                        >
                          {wr}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${wr}%`,
                            background: wr >= 50 ? 'var(--ok)' : wr > 0 ? 'var(--orange)' : 'var(--border-strong)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top trades */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Top Trades</div>
          </div>
          <div className="p-4">
            {topTrades.length === 0 ? (
              <p className="text-[13px] py-4 text-center" style={{ color: 'var(--text-subtle)' }}>No trade data yet</p>
            ) : (
              <div className="space-y-2.5">
                {topTrades.map(([trade, { total, won: w }]) => (
                  <div key={trade} className="flex items-center gap-3">
                    <span className="text-[12px] font-medium w-28 shrink-0 truncate" style={{ color: 'var(--text-2)' }}>{trade}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[12px] mb-1">
                        <span style={{ color: 'var(--text-subtle)' }}>{total} bids</span>
                        {w > 0 && <span className="font-semibold" style={{ color: 'var(--ok)' }}>{w} won</span>}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct(total, topTrades[0][1].total)}%`, background: 'var(--navy)' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon, accentColor }: {
  label: string; value: string; sub: string; icon: React.ReactNode; accentColor: string;
}) {
  return (
    <div
      className="card p-5"
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="label-mono">{label}</span>
        <span style={{ color: 'var(--border-strong)' }}>{icon}</span>
      </div>
      <div className="text-[22px] font-bold" style={{ color: accentColor }}>{value}</div>
      <div className="text-[11px] mt-1" style={{ color: 'var(--text-subtle)' }}>{sub}</div>
    </div>
  );
}
