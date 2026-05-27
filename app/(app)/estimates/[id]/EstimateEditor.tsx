'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Save, Loader2, ChevronDown } from 'lucide-react';
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
      {/* Toolbar */}
      <div className="card flex items-center gap-4 flex-wrap p-4">
        <div className="flex items-center gap-2">
          <span className="label-mono">Status</span>
          <div className="relative">
            <select
              value={status}
              onChange={e => { setStatus(e.target.value as EstimateStatus); setSaved(false); }}
              className="appearance-none text-[12px] font-semibold rounded px-2.5 py-1 pr-6 cursor-pointer outline-none border-0"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-subtle)' }} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="label-mono">Markup</span>
          <div className="flex items-center rounded border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <input
              type="number"
              min={0} max={100} step={0.5}
              value={markup}
              onChange={e => { setMarkup(Number(e.target.value)); setSaved(false); }}
              className="w-12 text-[13px] font-semibold text-center outline-none px-2 py-1"
              style={{ background: 'var(--surface)', color: 'var(--text)' }}
            />
            <span className="px-2 py-1 text-[12px]" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>%</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>Grand Total</div>
            <div className="text-[17px] font-bold" style={{ color: 'var(--navy)' }}>{formatCurrency(grandTotal)}</div>
          </div>
          {error && <span className="text-[12px]" style={{ color: 'var(--bad)' }}>{error}</span>}
          {saved && !error && <span className="text-[12px] font-semibold" style={{ color: 'var(--ok)' }}>Saved</span>}
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm flex items-center gap-1.5">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Line items table */}
      <div className="card overflow-hidden p-0">
        <div className="card-head flex items-center justify-between">
          <h2 className="card-title">Line Items</h2>
          <div className="flex items-center gap-4 text-[12px]" style={{ color: 'var(--text-muted)' }}>
            <span>Subtotal: <span className="font-semibold" style={{ color: 'var(--navy)' }}>{formatCurrency(subtotal)}</span></span>
            <span>Markup: <span className="font-semibold" style={{ color: 'var(--navy)' }}>{formatCurrency(subtotal * markup / 100)}</span></span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Trade', 'Description', 'Qty', 'Unit', 'Unit Price', 'Total', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`px-3 py-2.5 label-mono text-left ${['Qty', 'Unit Price', 'Total'].includes(h) ? 'text-right' : ''} ${h === '' ? 'w-8' : ''} ${h === 'Trade' ? 'w-32' : ''} ${h === 'Qty' ? 'w-20' : ''} ${h === 'Unit' ? 'w-16' : ''} ${h === 'Unit Price' ? 'w-24' : ''} ${h === 'Total' ? 'w-24' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr
                  key={i}
                  className="group"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <td className="px-3 py-2">
                    <select
                      value={item.trade}
                      onChange={e => updateItem(i, 'trade', e.target.value)}
                      className="w-full text-[12px] font-medium rounded px-1.5 py-1 border-0 outline-none cursor-pointer"
                      style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
                    >
                      {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={item.description}
                      onChange={e => updateItem(i, 'description', e.target.value)}
                      placeholder="Description…"
                      className="w-full bg-transparent border-0 outline-none rounded px-1 py-0.5"
                      style={{ color: 'var(--text)' }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      value={item.qty || ''}
                      onChange={e => updateItem(i, 'qty', parseFloat(e.target.value) || 0)}
                      className="w-full text-right bg-transparent border-0 outline-none rounded px-1 py-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={item.unit}
                      onChange={e => updateItem(i, 'unit', e.target.value)}
                      className="w-full bg-transparent border-0 outline-none rounded px-1 py-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unit_price || ''}
                      onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="w-full text-right bg-transparent border-0 outline-none rounded px-1 py-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--navy)' }}>
                    {formatCurrency(item.total)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removeRow(i)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--bad)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface-2)' }}>
                <td colSpan={5} className="px-3 py-3 text-right text-[13px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Grand Total (incl. {markup}% markup)
                </td>
                <td className="px-3 py-3 text-right text-[16px] font-bold" style={{ color: 'var(--navy)' }}>
                  {formatCurrency(grandTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-[12px] font-medium transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--orange)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <Plus size={13} /> Add Line Item
          </button>
        </div>
      </div>

      {/* Notes */}
      <div className="card p-4">
        <h2 className="card-title mb-2">Notes / Assumptions</h2>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); setSaved(false); }}
          rows={3}
          placeholder="Key assumptions, exclusions, qualifications…"
          className="w-full text-[13px] rounded border px-3 py-2 outline-none resize-none"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
          }}
        />
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary flex items-center gap-1.5">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <a href={`/estimates/${estimateId}/print`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
          Export PDF
        </a>
        {bidId && (
          <a href={`/proposals/new?bid=${bidId}&estimate=${estimateId}`} className="btn btn-accent flex items-center gap-1.5">
            Draft Proposal →
          </a>
        )}
        {bidId && (
          <a href={`/bids/${bidId}`} className="btn btn-ghost">View Bid</a>
        )}
      </div>
    </div>
  );
}
