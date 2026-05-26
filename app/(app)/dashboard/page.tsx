import { createClient } from '@/lib/supabase/server';
import { getDaysLeft, formatDate, formatCurrency, STATUS_COLORS, getUrgencyClass, getUrgencyLabel } from '@/lib/utils';
import type { Bid } from '@/lib/types';
import Link from 'next/link';
import { AlertCircle, TrendingUp, Clock, CheckCircle2, DollarSign } from 'lucide-react';

export const revalidate = 0;

async function getBids(): Promise<Bid[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bids')
    .select('*')
    .order('bid_due_date', { ascending: true, nullsFirst: false });
  if (error) { console.error(error); return []; }
  return data as Bid[];
}

export default async function DashboardPage() {
  const bids = await getBids();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const active = bids.filter(b => !['Won','Lost','Declined','Expired'].includes(b.status));
  const urgent = bids.filter(b => { const d = getDaysLeft(b.bid_due_date); return d !== null && d >= 0 && d <= 3; });
  const thisWeek = bids.filter(b => { const d = getDaysLeft(b.bid_due_date); return d !== null && d >= 0 && d <= 7; });
  const submitted = bids.filter(b => b.status === 'Submitted');
  const won = bids.filter(b => b.status === 'Won');

  const upcomingBids = active
    .filter(b => b.bid_due_date)
    .sort((a, b) => new Date(a.bid_due_date!).getTime() - new Date(b.bid_due_date!).getTime())
    .slice(0, 10);

  const statusCounts = bids.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a3a5c]">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Urgent banner */}
      {urgent.length > 0 && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-700">⚠ {urgent.length} bid{urgent.length > 1 ? 's' : ''} due within 3 days</p>
            <p className="text-xs text-red-600 mt-1">
              {urgent.map(b => `${b.project_name} (${formatDate(b.bid_due_date, 'MMM d')})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Bids', value: bids.length, icon: TrendingUp, color: 'border-[#e87722]' },
          { label: 'Due ≤ 3 Days', value: urgent.length, icon: AlertCircle, color: 'border-red-500', valueColor: 'text-red-600' },
          { label: 'Due This Week', value: thisWeek.length, icon: Clock, color: 'border-orange-400', valueColor: 'text-orange-500' },
          { label: 'Submitted', value: submitted.length, icon: CheckCircle2, color: 'border-yellow-400' },
          { label: 'Won', value: won.length, icon: DollarSign, color: 'border-green-500', valueColor: 'text-green-600' },
        ].map(({ label, value, icon: Icon, color, valueColor }) => (
          <div key={label} className={`bg-white rounded-xl p-4 shadow-sm border-t-4 ${color} hover:-translate-y-0.5 transition-transform`}>
            <div className={`text-3xl font-black ${valueColor ?? 'text-[#1a3a5c]'}`}>{value}</div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Upcoming bids table */}
        <div className="col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1a3a5c] uppercase tracking-wider">Upcoming Bids</h2>
            <Link href="/bids" className="text-xs text-[#e87722] font-semibold hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {upcomingBids.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No upcoming bids</div>
            ) : (
              upcomingBids.map(bid => {
                const days = getDaysLeft(bid.bid_due_date);
                const { bg, text, border } = STATUS_COLORS[bid.status] ?? STATUS_COLORS.New;
                return (
                  <Link key={bid.id} href={`/bids/${bid.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#1a3a5c] truncate">{bid.project_name}</div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">
                        {[bid.city, bid.state].filter(Boolean).join(', ')}
                        {bid.gc_name ? ` · ${bid.gc_name}` : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-gray-500">{formatDate(bid.bid_due_date, 'MMM d')}</div>
                      <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${getUrgencyClass(days)}`}>
                        {getUrgencyLabel(days)}
                      </span>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${bg} ${text} ${border ?? ''} shrink-0`}>
                      {bid.status}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Status breakdown */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-[#1a3a5c] uppercase tracking-wider">Status Breakdown</h2>
          </div>
          <div className="p-4 space-y-2">
            {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
              const { bg, text } = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.New;
              const pct = Math.round((count / bids.length) * 100);
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`font-bold px-2 py-0.5 rounded-full ${bg} ${text}`}>{status}</span>
                    <span className="font-bold text-[#1a3a5c]">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1a3a5c] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick actions */}
          <div className="px-4 pb-4 pt-2 border-t border-gray-100 mt-2 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
            <Link href="/bids" className="block text-center bg-[#1a3a5c] text-white text-xs font-bold py-2.5 rounded-lg hover:bg-[#e87722] transition-colors">
              + New Bid
            </Link>
            <Link href="/estimates" className="block text-center border border-[#1a3a5c] text-[#1a3a5c] text-xs font-bold py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
              Upload Plans
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
