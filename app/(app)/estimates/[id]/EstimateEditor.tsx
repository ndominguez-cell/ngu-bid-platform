'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type EstimateStatus = 'Draft' | 'In Review' | 'Approved' | 'Submitted' | 'Archived';

interface LineItem {
  trade: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
}

interface EstimateEditorProps {
  estimateId: string;
  initialLineItems: LineItem[];
  initialMarkup: number;
  initialStatus: EstimateStatus;
  initialNotes: string | null;
  bidId: string | null;
}

const STATUSES: EstimateStatus[] = ['Draft', 'In Review', 'Approved', 'Submitted', 'Archived'];
const STATUS_COLORS: Record<EstimateStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  'In Review': 'bg-blue-100 text-blue-700',
  Approved: 'bg-green-100 text-green-700',
  Submitted: 'bg-yellow-100 text-yellow-700',
  Archived: 'bg-gray-100 text-gray-400',
};

const TRADES = ['Concrete', 'Earthwork', 'Asphalt/Paving', 'Drainage', 'Utilities', 'Masonry', 'Structural Steel', 'Striping', 'Sitework', 'Other'];

export default function EstimateEditor({
  estimateId,
  initialLineItems,
  initialMarkup,
  initialStatus,
  initialNotes,
  bidId,
}: EstimateEditorProps) {
  const router = useRouter();
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems);
  const [markup, setMarkup] = useState(initialMarkup);
  const [status, setStatus] = useState<EstimateStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const subtotal = lineItems.reduce((s, li) => s + (li.total || 0), 0);
  const grandTotal = Math.round(subtotal * (1 + markup / 100));

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setLineItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === 'qty' || field === 'unit_price') {
        item.total = Math.round((Number(item.qty) || 0) * (Number(item.unit_price) || 0));
      }
      updated[index] = item;
      return updated;
    });
    setSaved(false);
  }

  function addRow() {
    setLineItems(prev => [...prev, { trade: 'Concrete', description: '', qty: 0, unit: 'SF', unit_price: 0, total: 0 }]);
    setSaved(false);
  }

  function removeRow(index: number) {
    setLineItems(prev => prev.filter((_, i) => i !== index));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/estimates/${estimateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_items: lineItems, markup_pct: markup, status, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSaved(true);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Status + Markup toolbar */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</span>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value as EstimateStatus); setSaved(false); }}
            className={`text-xs font-bold px-2.5 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[status]}`}
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Markup</span>
          <div className="flex items-center">
            <input
              type="number"
              min={0} max={100} step={0.5}
              value={markup}
              onChange={e => { setMarkup(Number(e.target.value)); setSaved(false); }}
              className="w-14 text-sm font-bold text-center border border-gray-200 rounded-l-lg px-2 py-1 focus:outline-none focus:border-[#1a3a5c]"
            />
            <span className="bg-gray-100 border border-gray-200 border-l-0 rounded-r-lg px-2 py-1 text-xs text-gray-500">%</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-gray-400">Grand Total</div>
            <div className="text-lg font-black text-[#1a3a5c]">{formatCurrency(grandTotal)}</div>
          </div>
          {error && <span className="text-xs text-red-600">{error}</span>}
          {saved && !error && <span className="text-xs text-green-600 font-semibold">Saved ✓</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-[#1a3a5c] hover:bg-[#e87722] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Line items table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#1a3a5c] uppercase tracking-wider">Line Items</h2>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Subtotal: <span className="font-bold text-[#1a3a5c]">{formatCurrency(subtotal)}</span></span>
            <span>Markup: <span className="font-bold text-[#1a3a5c]">{formatCurrency(subtotal * markup / 100)}</span></span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-3 py-3 text-xs font-bold text-gray-500 uppercase w-32">Trade</th>
                <th className="text-left px-3 py-3 text-xs font-bold text-gray-500 uppercase">Description</th>
                <th className="text-right px-3 py-3 text-xs font-bold text-gray-500 uppercase w-20">Qty</th>
                <th className="text-left px-3 py-3 text-xs font-bold text-gray-500 uppercase w-16">Unit</th>
                <th className="text-right px-3 py-3 text-xs font-bold text-gray-500 uppercase w-24">Unit Price</th>
                <th className="text-right px-3 py-3 text-xs font-bold text-gray-500 uppercase w-24">Total</th>
                <th className="px-3 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lineItems.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50/50 group">
                  <td className="px-3 py-2">
                    <select
                      value={item.trade}
                      onChange={e => updateItem(i, 'trade', e.target.value)}
                      className="w-full text-xs font-medium text-purple-700 bg-purple-50 rounded px-1.5 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-purple-300 cursor-pointer"
                    >
                      {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={item.description}
                      onChange={e => updateItem(i, 'description', e.target.value)}
                      placeholder="Description…"
                      className="w-full text-gray-700 bg-transparent border-0 focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      value={item.qty || ''}
                      onChange={e => updateItem(i, 'qty', parseFloat(e.target.value) || 0)}
                      className="w-full text-right text-gray-600 bg-transparent border-0 focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={item.unit}
                      onChange={e => updateItem(i, 'unit', e.target.value)}
                      className="w-full text-gray-500 bg-transparent border-0 focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unit_price || ''}
                      onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="w-full text-right text-gray-600 bg-transparent border-0 focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-[#1a3a5c] text-sm">
                    {formatCurrency(item.total)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removeRow(i)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td colSpan={5} className="px-3 py-3 text-sm font-bold text-[#1a3a5c] text-right">
                  Grand Total (incl. {markup}% markup)
                </td>
                <td className="px-3 py-3 text-right text-lg font-black text-[#1a3a5c]">{formatCurrency(grandTotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-100">
          <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-[#1a3a5c] hover:text-[#e87722] font-semibold transition-colors">
            <Plus size={13} /> Add Line Item
          </button>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider mb-2">Notes / Assumptions</h2>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); setSaved(false); }}
          rows={3}
          placeholder="Key assumptions, exclusions, qualifications…"
          className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1a3a5c] resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="bg-[#1a3a5c] hover:bg-[#e87722] text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {bidId && (
          <a href={`/proposals/new?bid=${bidId}&estimate=${estimateId}`}
            className="bg-[#e87722] hover:bg-[#d06a1a] text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors">
            Draft Proposal →
          </a>
        )}
        {bidId && (
          <a href={`/bids/${bidId}`}
            className="border border-gray-200 text-gray-600 font-semibold px-5 py-2.5 rounded-lg text-sm hover:border-[#1a3a5c] transition-colors">
            View Bid
          </a>
        )}
      </div>
    </div>
  );
}
