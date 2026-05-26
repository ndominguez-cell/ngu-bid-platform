import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, Mail, Copy } from 'lucide-react';

export const revalidate = 0;

export default async function ProposalDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('proposals')
    .select('*, bids(project_name, gc_name, gc_email, bid_due_date, city, state)')
    .eq('id', params.id)
    .single();

  if (error || !data) notFound();

  const p = data as any;

  const STATUS_COLORS: Record<string, string> = {
    Draft:    'bg-gray-100 text-gray-600',
    Reviewed: 'bg-yellow-100 text-yellow-700',
    Sent:     'bg-green-100 text-green-700',
    Declined: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/proposals" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1a3a5c] mb-4 transition-colors">
        <ArrowLeft size={14} /> Back to Proposals
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c] leading-tight">{p.subject}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {p.bids && (
              <Link href={`/bids/${p.bid_id}`} className="text-sm text-[#e87722] hover:underline font-medium">
                {p.bids.project_name}
              </Link>
            )}
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[p.status] ?? STATUS_COLORS.Draft}`}>
              {p.status}
            </span>
            <span className="text-xs text-gray-400">{formatDate(p.created_at)}</span>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {p.bids?.gc_email && (
            <a href={`mailto:${p.bids.gc_email}?subject=${encodeURIComponent(p.subject)}&body=${encodeURIComponent(p.body_final ?? p.body_draft ?? '')}`}
              className="flex items-center gap-1.5 text-xs bg-[#1a3a5c] text-white px-3 py-2 rounded-lg hover:bg-[#e87722] transition-colors font-semibold">
              <Mail size={13} /> Open in Mail
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Proposal body */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Proposal Email</h2>
              <span className="text-xs text-gray-400">AI-generated draft</span>
            </div>
            <div className="p-5">
              <div className="bg-gray-50 rounded-lg p-4 mb-3 space-y-1 text-xs text-gray-600">
                <div><span className="font-bold">To:</span> {p.bids?.gc_email || p.bids?.gc_name || '—'}</div>
                <div><span className="font-bold">Subject:</span> {p.subject}</div>
              </div>
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                  {p.body_final || p.body_draft || 'No content'}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider mb-3">Details</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Project</p>
                <p className="text-gray-700 font-medium">{p.bids?.project_name || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">GC</p>
                <p className="text-gray-700">{p.bids?.gc_name || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Send To</p>
                <p className="text-gray-700">{p.bids?.gc_email || '—'}</p>
              </div>
              {p.sent_at && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Sent</p>
                  <p className="text-gray-700">{formatDate(p.sent_at)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 space-y-2">
            <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider mb-3">Actions</h2>
            {p.bids?.gc_email && (
              <a href={`mailto:${p.bids.gc_email}?subject=${encodeURIComponent(p.subject)}&body=${encodeURIComponent(p.body_final ?? p.body_draft ?? '')}`}
                className="flex items-center justify-center gap-2 w-full bg-[#1a3a5c] hover:bg-[#e87722] text-white text-xs font-bold py-2.5 rounded-lg transition-colors">
                <Mail size={13} /> Send via Gmail
              </a>
            )}
            <Link href={`/bids/${p.bid_id}`}
              className="flex items-center justify-center gap-2 w-full border border-gray-200 text-gray-600 text-xs font-semibold py-2.5 rounded-lg hover:border-[#1a3a5c] transition-colors">
              View Bid
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
