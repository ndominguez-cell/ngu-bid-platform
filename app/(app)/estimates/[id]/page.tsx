import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { formatDate, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export const revalidate = 0;

export default async function EstimateDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('estimates')
    .select('*, bids(project_name, city, state, gc_name, bid_due_date)')
    .eq('id', params.id)
    .single();

  if (error || !data) notFound();

  const est = data as any;
  const lineItems: any[] = est.line_items ?? [];
  const subtotal = lineItems.reduce((sum: number, li: any) => sum + (li.total ?? 0), 0);

  const STATUS_COLORS: Record<string, string> = {
    Draft:      'bg-gray-100 text-gray-600',
    'In Review':'bg-blue-100 text-blue-700',
    Approved:   'bg-green-100 text-green-700',
    Submitted:  'bg-yellow-100 text-yellow-700',
    Archived:   'bg-gray-100 text-gray-400',
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
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[est.status] ?? STATUS_COLORS.Draft}`}>
              {est.status}
            </span>
            <span className="text-xs text-gray-400">{formatDate(est.created_at)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-[#1a3a5c]">{formatCurrency(est.total_amount)}</div>
          <div className="text-xs text-gray-400 mt-1">Total (incl. {est.markup_pct}% markup)</div>
        </div>
      </div>

      {/* AI Summary */}
      {est.ai_summary && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-sm text-blue-800">
          <p className="font-bold mb-1">AI Takeoff Summary</p>
          <p className="whitespace-pre-wrap">{est.ai_summary}</p>
        </div>
      )}

      {/* Line Items */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#1a3a5c] uppercase tracking-wider">Line Items</h2>
          <div className="text-xs text-gray-500">
            Subtotal: <span className="font-bold text-[#1a3a5c]">{formatCurrency(subtotal)}</span>
            {' · '}Markup ({est.markup_pct}%): <span className="font-bold text-[#1a3a5c]">{formatCurrency(subtotal * (est.markup_pct / 100))}</span>
          </div>
        </div>

        {lineItems.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <FileText size={32} className="mx-auto mb-3 text-gray-200" />
            <p>No line items yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Trade</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Description</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Qty</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Unit</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Unit Price</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lineItems.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs font-medium text-purple-700 bg-purple-50/50">{item.trade}</td>
                    <td className="px-4 py-2.5 text-gray-700">{item.description}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{item.qty?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-gray-500">{item.unit}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(item.unit_price)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-[#1a3a5c]">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={5} className="px-4 py-3 text-sm font-bold text-[#1a3a5c] text-right">Grand Total (w/ markup)</td>
                  <td className="px-4 py-3 text-right text-lg font-black text-[#1a3a5c]">{formatCurrency(est.total_amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Notes */}
      {est.notes && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
          <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider mb-2">Notes / Assumptions</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{est.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {est.bid_id && (
          <Link href={`/proposals/new?bid=${est.bid_id}&estimate=${est.id}`}
            className="bg-[#1a3a5c] hover:bg-[#e87722] text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors">
            Draft Proposal from This Estimate →
          </Link>
        )}
        {est.bid_id && (
          <Link href={`/bids/${est.bid_id}`}
            className="border border-gray-200 text-gray-600 font-semibold px-5 py-2.5 rounded-lg text-sm hover:border-[#1a3a5c] transition-colors">
            View Bid
          </Link>
        )}
      </div>
    </div>
  );
}
