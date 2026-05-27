import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';

export const revalidate = 0;

export default async function EstimatePrintPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('estimates')
    .select('*, bids(project_name, city, state, gc_name, bid_due_date, gc_email, address)')
    .eq('id', params.id)
    .single();

  if (error || !data) notFound();

  const est = data as {
    id: string;
    name: string;
    status: string;
    total_amount: number | null;
    markup_pct: number;
    notes: string | null;
    ai_summary: string | null;
    created_at: string;
    line_items: Array<{ trade: string; description: string; qty: number; unit: string; unit_price: number; total: number }>;
    bids: {
      project_name: string;
      city: string | null;
      state: string | null;
      gc_name: string | null;
      bid_due_date: string | null;
      gc_email: string | null;
      address: string | null;
    } | null;
  };

  const lineItems = est.line_items ?? [];
  const subtotal = lineItems.reduce((s, li) => s + (li.total || 0), 0);
  const markupAmt = subtotal * (est.markup_pct / 100);
  const grandTotal = Math.round(subtotal + markupAmt);

  // Group line items by trade
  const byTrade: Record<string, typeof lineItems> = {};
  for (const li of lineItems) {
    if (!byTrade[li.trade]) byTrade[li.trade] = [];
    byTrade[li.trade].push(li);
  }

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          @page { margin: 0.75in; size: letter; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      `}</style>

      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => window.print()}
          className="bg-[#1a3a5c] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#e87722] transition-colors shadow-lg"
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="bg-white border border-gray-200 text-gray-600 text-sm font-semibold px-4 py-2 rounded-lg hover:border-[#1a3a5c] transition-colors shadow-lg"
        >
          Close
        </button>
      </div>

      <div className="max-w-[800px] mx-auto p-8 bg-white min-h-screen">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-[#1a3a5c]">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-[#e87722] px-2 py-1 rounded">
                <span className="text-white font-black text-sm tracking-widest">NGU</span>
              </div>
              <span className="text-[#1a3a5c] font-bold text-sm">CONSTRUCTION</span>
            </div>
            <h1 className="text-2xl font-black text-[#1a3a5c]">{est.name}</h1>
            {est.bids && (
              <p className="text-base font-semibold text-gray-600 mt-1">{est.bids.project_name}</p>
            )}
          </div>
          <div className="text-right text-sm text-gray-500">
            <p className="font-bold text-[#1a3a5c] text-base">ESTIMATE</p>
            <p className="text-xs mt-1">Date: {formatDate(est.created_at)}</p>
            {est.bids?.bid_due_date && (
              <p className="text-xs">Bid Due: {formatDate(est.bids.bid_due_date)}</p>
            )}
            <p className={`mt-2 text-xs font-bold px-2 py-0.5 rounded inline-block ${
              est.status === 'Approved' ? 'bg-green-100 text-green-700' :
              est.status === 'Submitted' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-600'
            }`}>{est.status}</p>
          </div>
        </div>

        {/* Project info */}
        {est.bids && (
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            {est.bids.gc_name && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">General Contractor</p>
                <p className="font-semibold text-gray-700">{est.bids.gc_name}</p>
                {est.bids.gc_email && <p className="text-gray-500 text-xs">{est.bids.gc_email}</p>}
              </div>
            )}
            {(est.bids.address || est.bids.city) && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Project Location</p>
                <p className="font-semibold text-gray-700">
                  {[est.bids.address, est.bids.city, est.bids.state].filter(Boolean).join(', ')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Line items table */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="bg-[#1a3a5c] text-white">
              <th className="text-left px-3 py-2.5 text-xs font-bold uppercase w-32">Trade</th>
              <th className="text-left px-3 py-2.5 text-xs font-bold uppercase">Description</th>
              <th className="text-right px-3 py-2.5 text-xs font-bold uppercase w-16">Qty</th>
              <th className="text-left px-3 py-2.5 text-xs font-bold uppercase w-12">Unit</th>
              <th className="text-right px-3 py-2.5 text-xs font-bold uppercase w-24">Unit Price</th>
              <th className="text-right px-3 py-2.5 text-xs font-bold uppercase w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 text-xs font-medium text-purple-700">{item.trade}</td>
                <td className="px-3 py-2 text-gray-700">{item.description}</td>
                <td className="px-3 py-2 text-right text-gray-600">{item.qty.toLocaleString()}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{item.unit}</td>
                <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(item.unit_price)}</td>
                <td className="px-3 py-2 text-right font-bold text-[#1a3a5c]">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200">
              <td colSpan={5} className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase">Subtotal</td>
              <td className="px-3 py-2 text-right font-bold text-gray-700">{formatCurrency(subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase">
                Markup ({est.markup_pct}%)
              </td>
              <td className="px-3 py-2 text-right font-bold text-gray-700">{formatCurrency(markupAmt)}</td>
            </tr>
            <tr className="bg-[#1a3a5c] text-white">
              <td colSpan={5} className="px-3 py-3 text-right font-black uppercase text-sm tracking-wider">Grand Total</td>
              <td className="px-3 py-3 text-right font-black text-lg">{formatCurrency(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>

        {/* AI Summary */}
        {est.ai_summary && (
          <div className="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm">
            <p className="font-bold text-blue-800 mb-1 text-xs uppercase tracking-wider">Takeoff Notes</p>
            <p className="text-blue-700 whitespace-pre-wrap text-xs">{est.ai_summary}</p>
          </div>
        )}

        {/* Notes */}
        {est.notes && (
          <div className="mb-5 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            <p className="font-bold text-gray-600 mb-1 text-xs uppercase tracking-wider">Notes / Assumptions</p>
            <p className="text-gray-600 whitespace-pre-wrap text-xs">{est.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-400">
          <span>NGU Construction — ndominguez@nguconstruction.com</span>
          <span>Generated {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </>
  );
}
