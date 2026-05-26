import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Send, FileText, CheckCircle2, Clock } from 'lucide-react';

export const revalidate = 0;

export default async function ProposalsPage() {
  const supabase = createClient();
  const { data: proposals } = await supabase
    .from('proposals')
    .select('*, bids(project_name, gc_name, gc_email)')
    .order('created_at', { ascending: false });

  const counts = {
    Draft: proposals?.filter(p => p.status === 'Draft').length ?? 0,
    Reviewed: proposals?.filter(p => p.status === 'Reviewed').length ?? 0,
    Sent: proposals?.filter(p => p.status === 'Sent').length ?? 0,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c]">Proposals</h1>
          <p className="text-gray-500 text-sm mt-0.5">AI-drafted · You review · Send via Gmail</p>
        </div>
        <Link href="/proposals/new" className="flex items-center gap-2 bg-[#1a3a5c] hover:bg-[#e87722] text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
          <Send size={14} /> Draft Proposal
        </Link>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Drafts', count: counts.Draft, icon: FileText, color: 'border-gray-300' },
          { label: 'Ready to Send', count: counts.Reviewed, icon: CheckCircle2, color: 'border-yellow-400' },
          { label: 'Sent', count: counts.Sent, icon: Send, color: 'border-green-500', valueColor: 'text-green-600' },
        ].map(({ label, count, icon: Icon, color, valueColor }) => (
          <div key={label} className={`bg-white rounded-xl p-4 shadow-sm border-t-4 ${color}`}>
            <div className={`text-3xl font-black ${valueColor ?? 'text-[#1a3a5c]'}`}>{count}</div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1 flex items-center gap-1">
              <Icon size={12} />{label}
            </div>
          </div>
        ))}
      </div>

      {/* Proposals list */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-[#1a3a5c] uppercase tracking-wider">All Proposals</h2>
        </div>
        {(!proposals || proposals.length === 0) ? (
          <div className="p-12 text-center text-gray-400">
            <Send size={32} className="mx-auto mb-3 text-gray-200" />
            <p className="font-medium mb-1">No proposals yet</p>
            <p className="text-xs max-w-sm mx-auto">Select a bid, choose an estimate, and Claude will draft a professional proposal email ready for your review.</p>
            <Link href="/proposals/new" className="inline-block mt-4 bg-[#1a3a5c] text-white font-bold px-5 py-2.5 rounded-lg text-sm hover:bg-[#e87722] transition-colors">
              Draft Your First Proposal
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {proposals.map((p: any) => (
              <Link key={p.id} href={`/proposals/${p.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#1a3a5c] truncate">{p.subject}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    {p.bids?.project_name} · {p.bids?.gc_name || p.bids?.gc_email || '—'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    p.status === 'Sent'     ? 'bg-green-100 text-green-700' :
                    p.status === 'Reviewed' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{p.status}</span>
                  <div className="text-[10px] text-gray-400 mt-1">{formatDate(p.created_at)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
