import { createClient } from '@/lib/supabase/server';
import { formatDate, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Upload, Calculator } from 'lucide-react';

export const revalidate = 0;

export default async function EstimatesPage() {
  const supabase = createClient();
  const { data: estimates } = await supabase
    .from('estimates')
    .select('*, bids(project_name, city, state)')
    .order('created_at', { ascending: false });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c]">Estimates</h1>
          <p className="text-gray-500 text-sm mt-0.5">Upload plans · AI takeoff · Build line items</p>
        </div>
        <Link href="/estimates/new" className="flex items-center gap-2 bg-[#1a3a5c] hover:bg-[#e87722] text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
          <Upload size={15} /> Upload Plans
        </Link>
      </div>

      {/* Upload CTA if empty */}
      {(!estimates || estimates.length === 0) && (
        <div className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-gray-200 p-12 text-center mb-6">
          <Calculator size={40} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-lg font-bold text-gray-500 mb-2">No estimates yet</h2>
          <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
            Upload plans or specs for a bid and Claude will analyze them to generate a takeoff and line-item estimate automatically.
          </p>
          <Link href="/estimates/new" className="inline-flex items-center gap-2 bg-[#1a3a5c] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#e87722] transition-colors">
            <Upload size={16} /> Upload Your First Plans
          </Link>
        </div>
      )}

      {/* Estimates list */}
      {estimates && estimates.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Estimate</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Project</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Total</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {estimates.map((est: any) => (
                <tr key={est.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/estimates/${est.id}`} className="font-semibold text-[#1a3a5c] hover:text-[#e87722] transition-colors">
                      {est.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {est.bids?.project_name || '—'}
                    {est.bids?.city && <span className="text-gray-400"> · {est.bids.city}, {est.bids.state}</span>}
                  </td>
                  <td className="px-4 py-3 font-bold text-[#1a3a5c]">{formatCurrency(est.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      est.status === 'Approved' ? 'bg-green-100 text-green-700' :
                      est.status === 'Submitted' ? 'bg-yellow-100 text-yellow-700' :
                      est.status === 'In Review' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{est.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(est.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
