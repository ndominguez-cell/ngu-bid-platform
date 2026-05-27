import { createClient } from '@/lib/supabase/server';
import { getDaysLeft, formatDate, STATUS_COLORS, getUrgencyClass, getUrgencyLabel, BID_STATUSES } from '@/lib/utils';
import type { Bid, BidStatus } from '@/lib/types';
import Link from 'next/link';
import { ExternalLink, Mail } from 'lucide-react';
import GmailImportButton from './GmailImportButton';

export const revalidate = 0;

async function getBids(): Promise<Bid[]> {
  const supabase = createClient();
  const { data } = await supabase.from('bids').select('*').order('bid_due_date', { ascending: true, nullsFirst: false });
  return (data ?? []) as Bid[];
}

export default async function BidsPage() {
  const bids = await getBids();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c]">Bids</h1>
          <p className="text-gray-500 text-sm mt-0.5">{bids.length} total bid requests</p>
        </div>
        <div className="flex items-center gap-2">
          <GmailImportButton />
          <Link href="/bids/new" className="bg-[#1a3a5c] hover:bg-[#e87722] text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
            + New Bid
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Project</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Location</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">GC</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Bid Due</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Days Left</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Trades</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bids.map(bid => {
                const days = getDaysLeft(bid.bid_due_date);
                const { bg, text, border } = STATUS_COLORS[bid.status] ?? STATUS_COLORS.New;
                return (
                  <tr key={bid.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#1a3a5c] max-w-[220px]">
                        <Link href={`/bids/${bid.id}`} className="hover:text-[#e87722] transition-colors line-clamp-1">
                          {bid.project_name}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          bid.source === 'PlanHub' ? 'bg-purple-100 text-purple-700' :
                          bid.source === 'Procore'  ? 'bg-orange-100 text-orange-700' :
                          bid.source === 'Novel'    ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>{bid.source}</span>
                        <span className="text-[10px] text-gray-400">{bid.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {[bid.city, bid.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-[150px]">
                      <div className="truncate">{bid.gc_name || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap text-gray-600">
                      {formatDate(bid.bid_due_date)}
                      {bid.bid_due_time && <div className="text-[10px] text-gray-400">{bid.bid_due_time}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${getUrgencyClass(days)}`}>
                        {getUrgencyLabel(days)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px]">
                      <div className="truncate">{(bid.trades ?? []).slice(0, 3).join(' · ') || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${bg} ${text} ${border ?? ''}`}>
                        {bid.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {bid.plans_link && (
                          <a href={bid.plans_link} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#1a3a5c]" title="View Plans">
                            <ExternalLink size={14} />
                          </a>
                        )}
                        {bid.thread_id && (
                          <a href={`https://mail.google.com/mail/u/0/#inbox/${bid.thread_id}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#e87722]" title="View in Gmail">
                            <Mail size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {bids.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg mb-2">No bids yet</p>
            <p className="text-sm">Run the seed endpoint to import your existing bids, or add one manually.</p>
          </div>
        )}
      </div>
    </div>
  );
}
