import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import type { Bid } from '@/lib/types';
import Link from 'next/link';
import { TrendingUp, TrendingDown, DollarSign, Target, BarChart2, Award } from 'lucide-react';

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

  // --- Core stats ---
  const concluded = bids.filter(b => ['Won', 'Lost', 'Declined', 'Expired'].includes(b.status));
  const won = bids.filter(b => b.status === 'Won');
  const lost = bids.filter(b => b.status === 'Lost');
  const active = bids.filter(b => ['New', 'Reviewing', 'Active'].includes(b.status));
  const submitted = bids.filter(b => b.status === 'Submitted');

  const winRate = pct(won.length, won.length + lost.length);

  const totalBidValue = bids.reduce((s, b) => s + (b.our_bid_amount ?? 0), 0);
  const wonValue = won.reduce((s, b) => s + (b.awarded_amount ?? b.our_bid_amount ?? 0), 0);
  const activePipeline = active.reduce((s, b) => s + (b.our_bid_amount ?? 0), 0);

  const avgBid = bids.filter(b => b.our_bid_amount).length
    ? totalBidValue / bids.filter(b => b.our_bid_amount).length
    : 0;

  // --- By source ---
  const sources = ['PlanHub', 'Procore', 'Novel', 'Direct', 'Gmail'];
  const bySource = sources.map(src => {
    const group = bids.filter(b => b.source === src);
    const wonGroup = group.filter(b => b.status === 'Won');
    const lostGroup = group.filter(b => b.status === 'Lost');
    return {
      source: src,
      total: group.length,
      won: wonGroup.length,
      lost: lostGroup.length,
      winRate: pct(wonGroup.length, wonGroup.length + lostGroup.length),
    };
  }).filter(s => s.total > 0);

  // --- By status ---
  const statuses = ['New', 'Reviewing', 'Active', 'Submitted', 'Won', 'Lost', 'Declined', 'Expired'];
  const byStatus = statuses.map(st => ({
    status: st,
    count: bids.filter(b => b.status === st).length,
  })).filter(s => s.count > 0);

  // --- Monthly trend (last 12 months) ---
  const now = new Date();
  const months: { label: string; bids: number; won: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const monthBids = bids.filter(b => {
      const bd = b.bid_due_date ?? b.created_at;
      const bdate = new Date(bd);
      return bdate.getFullYear() === d.getFullYear() && bdate.getMonth() === d.getMonth();
    });
    months.push({ label, bids: monthBids.length, won: monthBids.filter(b => b.status === 'Won').length });
  }

  const maxMonthBids = Math.max(...months.map(m => m.bids), 1);

  // --- Top trades ---
  const tradeCounts: Record<string, { total: number; won: number }> = {};
  for (const b of bids) {
    for (const t of b.trades ?? []) {
      if (!tradeCounts[t]) tradeCounts[t] = { total: 0, won: 0 };
      tradeCounts[t].total++;
      if (b.status === 'Won') tradeCounts[t].won++;
    }
  }
  const topTrades = Object.entries(tradeCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8);

  const STATUS_COLORS: Record<string, string> = {
    New: 'bg-gray-200 text-gray-700',
    Reviewing: 'bg-blue-100 text-blue-700',
    Active: 'bg-indigo-100 text-indigo-700',
    Submitted: 'bg-yellow-100 text-yellow-700',
    Won: 'bg-green-100 text-green-700',
    Lost: 'bg-red-100 text-red-700',
    Declined: 'bg-orange-100 text-orange-700',
    Expired: 'bg-gray-100 text-gray-400',
  };

  const SOURCE_COLORS: Record<string, string> = {
    PlanHub: 'bg-purple-100 text-purple-700',
    Procore: 'bg-orange-100 text-orange-700',
    Novel: 'bg-blue-100 text-blue-700',
    Direct: 'bg-green-100 text-green-700',
    Gmail: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a3a5c]">Analytics</h1>
        <p className="text-gray-500 text-sm mt-0.5">Win/loss performance across {bids.length} bids</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Win Rate"
          value={`${winRate}%`}
          sub={`${won.length}W / ${lost.length}L of ${won.length + lost.length} concluded`}
          icon={<Target size={18} />}
          color={winRate >= 50 ? 'border-green-500' : 'border-red-400'}
          valueColor={winRate >= 50 ? 'text-green-600' : 'text-red-500'}
        />
        <KpiCard
          label="Total Won"
          value={formatCurrency(wonValue)}
          sub={`from ${won.length} won bids`}
          icon={<Award size={18} />}
          color="border-green-500"
          valueColor="text-green-600"
        />
        <KpiCard
          label="Active Pipeline"
          value={formatCurrency(activePipeline)}
          sub={`${active.length} active + ${submitted.length} submitted`}
          icon={<TrendingUp size={18} />}
          color="border-[#e87722]"
        />
        <KpiCard
          label="Avg Bid Amount"
          value={formatCurrency(avgBid)}
          sub={`across ${bids.filter(b => b.our_bid_amount).length} bids with amounts`}
          icon={<DollarSign size={18} />}
          color="border-[#1a3a5c]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Monthly trend */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-[#1a3a5c] uppercase tracking-wider flex items-center gap-1.5">
              <BarChart2 size={14} /> Monthly Bid Activity
            </h2>
            <span className="text-xs text-gray-400">Last 12 months</span>
          </div>
          <div className="flex items-end gap-1.5 h-28">
            {months.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: '80px' }}>
                  {m.bids > 0 && (
                    <div
                      className="w-full bg-[#1a3a5c] rounded-t-sm relative group"
                      style={{ height: `${Math.round((m.bids / maxMonthBids) * 80)}px` }}
                    >
                      {m.won > 0 && (
                        <div
                          className="absolute bottom-0 left-0 w-full bg-green-500 rounded-t-sm"
                          style={{ height: `${Math.round((m.won / m.bids) * 100)}%` }}
                        />
                      )}
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {m.bids} bids · {m.won} won
                      </div>
                    </div>
                  )}
                  {m.bids === 0 && <div className="w-full h-0.5 bg-gray-100" style={{ marginTop: 'auto' }} />}
                </div>
                <span className="text-[9px] text-gray-400 font-medium">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#1a3a5c]" /> Total bids</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-green-500" /> Won</span>
          </div>
        </div>

        {/* Status breakdown */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-bold text-[#1a3a5c] uppercase tracking-wider mb-4">Status Breakdown</h2>
          <div className="space-y-2.5">
            {byStatus.map(({ status, count }) => {
              const colorClass = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full ${colorClass}`}>{status}</span>
                    <span className="font-bold text-[#1a3a5c]">{count} <span className="text-gray-400 font-normal">({pct(count, bids.length)}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1a3a5c] rounded-full transition-all" style={{ width: `${pct(count, bids.length)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* By source */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-bold text-[#1a3a5c] uppercase tracking-wider mb-4">Win Rate by Source</h2>
          {bySource.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No source data yet</p>
          ) : (
            <div className="space-y-3">
              {bySource.map(({ source, total, won: w, winRate: wr }) => (
                <div key={source} className="flex items-center gap-3">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider w-16 text-center shrink-0 ${SOURCE_COLORS[source] ?? 'bg-gray-100 text-gray-600'}`}>
                    {source}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500">{total} bids · {w} won</span>
                      <span className={`font-bold ${wr >= 50 ? 'text-green-600' : wr > 0 ? 'text-orange-500' : 'text-gray-400'}`}>{wr}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${wr >= 50 ? 'bg-green-500' : wr > 0 ? 'bg-orange-400' : 'bg-gray-200'}`}
                        style={{ width: `${wr}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top trades */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-bold text-[#1a3a5c] uppercase tracking-wider mb-4">Top Trades</h2>
          {topTrades.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No trade data yet</p>
          ) : (
            <div className="space-y-2.5">
              {topTrades.map(([trade, { total, won: w }]) => (
                <div key={trade} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 font-medium w-28 shrink-0 truncate">{trade}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400">{total} bids</span>
                      <span className="text-green-600 font-semibold">{w > 0 ? `${w} won` : ''}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1a3a5c] rounded-full" style={{ width: `${pct(total, topTrades[0][1].total)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'View All Bids', href: '/bids', count: bids.length },
          { label: 'Won Bids', href: '/bids', count: won.length },
          { label: 'Active Pipeline', href: '/bids', count: active.length },
          { label: 'All Estimates', href: '/estimates', count: null },
        ].map(({ label, href, count }) => (
          <Link key={label} href={href}
            className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between hover:shadow transition-shadow border border-transparent hover:border-[#1a3a5c]/10">
            <span className="text-sm font-semibold text-[#1a3a5c]">{label}</span>
            {count !== null && <span className="text-lg font-black text-[#e87722]">{count}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon, color, valueColor }: {
  label: string; value: string; sub: string; icon: React.ReactNode;
  color: string; valueColor?: string;
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-5 border-t-4 ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</span>
        <span className="text-gray-300">{icon}</span>
      </div>
      <div className={`text-2xl font-black ${valueColor ?? 'text-[#1a3a5c]'}`}>{value}</div>
      <div className="text-[11px] text-gray-400 mt-1">{sub}</div>
    </div>
  );
}
