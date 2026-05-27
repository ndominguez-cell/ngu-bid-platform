import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import EstimateEditor from './EstimateEditor';

export const revalidate = 0;

export default async function EstimateDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('estimates')
    .select('*, bids(project_name, city, state, gc_name, bid_due_date)')
    .eq('id', params.id)
    .single();

  if (error || !data) notFound();

  const est = data as {
    id: string;
    name: string;
    status: 'Draft' | 'In Review' | 'Approved' | 'Submitted' | 'Archived';
    total_amount: number | null;
    markup_pct: number;
    notes: string | null;
    ai_summary: string | null;
    line_items: Array<{ trade: string; description: string; qty: number; unit: string; unit_price: number; total: number }>;
    bid_id: string | null;
    created_at: string;
    bids: { project_name: string } | null;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/estimates" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1a3a5c] mb-4 transition-colors">
        <ArrowLeft size={14} /> Back to Estimates
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c]">{est.name}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {est.bids && (
              <Link href={`/bids/${est.bid_id}`} className="text-sm text-[#e87722] hover:underline font-medium">
                {est.bids.project_name}
              </Link>
            )}
            <span className="text-xs text-gray-400">{formatDate(est.created_at)}</span>
          </div>
        </div>
        <Link
          href={`/estimates/${est.id}/print`}
          target="_blank"
          className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:border-[#1a3a5c] hover:text-[#1a3a5c] transition-colors font-semibold"
        >
          <Printer size={13} /> Export PDF
        </Link>
      </div>

      {/* AI Summary */}
      {est.ai_summary && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-sm text-blue-800">
          <p className="font-bold mb-1">AI Takeoff Summary</p>
          <p className="whitespace-pre-wrap">{est.ai_summary}</p>
        </div>
      )}

      <EstimateEditor
        estimateId={est.id}
        initialLineItems={est.line_items ?? []}
        initialMarkup={est.markup_pct ?? 10}
        initialStatus={est.status ?? 'Draft'}
        initialNotes={est.notes}
        bidId={est.bid_id}
      />
    </div>
  );
}
