'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { TRADES, BID_STATUSES } from '@/lib/utils';

export default function NewBidPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    id: '',
    project_name: '',
    address: '',
    city: '',
    state: 'TX',
    gc_name: '',
    gc_email: '',
    gc_contact_name: '',
    gc_contact_phone: '',
    bid_due_date: '',
    bid_due_time: '',
    submit_to: '',
    scope: '',
    trades: [] as string[],
    plans_link: '',
    source: 'Direct',
    status: 'New',
    notes: '',
  });

  function toggle(trade: string) {
    setForm(prev => ({
      ...prev,
      trades: prev.trades.includes(trade)
        ? prev.trades.filter(t => t !== trade)
        : [...prev.trades, trade],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.project_name) { setError('Project name is required.'); return; }
    setSaving(true);
    setError('');

    // Auto-generate ID if not provided
    const payload = {
      ...form,
      id: form.id || undefined, // let DB handle or user provides
      address: form.address || null,
      city: form.city || null,
      gc_name: form.gc_name || null,
      gc_email: form.gc_email || null,
      gc_contact_name: form.gc_contact_name || null,
      gc_contact_phone: form.gc_contact_phone || null,
      bid_due_date: form.bid_due_date || null,
      bid_due_time: form.bid_due_time || null,
      submit_to: form.submit_to || null,
      scope: form.scope || null,
      plans_link: form.plans_link || null,
      notes: form.notes || null,
    };

    try {
      const res = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create bid');
      router.push(`/bids/${data.data.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create bid');
      setSaving(false);
    }
  }

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1a3a5c] transition-colors';
  const labelClass = 'block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/bids" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1a3a5c] mb-4 transition-colors">
        <ArrowLeft size={14} /> Back to Bids
      </Link>
      <h1 className="text-2xl font-bold text-[#1a3a5c] mb-1">New Bid</h1>
      <p className="text-gray-500 text-sm mb-6">Add a bid request manually</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Project */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Project</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Project Name *</label>
              <input type="text" required value={form.project_name} onChange={e => setForm(p => ({ ...p, project_name: e.target.value }))}
                placeholder="e.g. Brake Masters McKinney" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Bid ID (optional)</label>
              <input type="text" value={form.id} onChange={e => setForm(p => ({ ...p, id: e.target.value }))}
                placeholder="BID-2026-030" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Source</label>
              <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} className={inputClass}>
                {['PlanHub','Procore','Novel','Direct','Other'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Address</label>
              <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                placeholder="123 Main St" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>City</label>
                <input type="text" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                  placeholder="San Antonio" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>State</label>
                <input type="text" value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
                  placeholder="TX" className={inputClass} />
              </div>
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Scope of Work</label>
              <textarea value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))}
                rows={3} placeholder="Describe the work NGU would perform..."
                className={inputClass + ' resize-none'} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Plans Link</label>
              <input type="url" value={form.plans_link} onChange={e => setForm(p => ({ ...p, plans_link: e.target.value }))}
                placeholder="https://..." className={inputClass} />
            </div>
          </div>
        </div>

        {/* GC */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">General Contractor</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>GC / Company Name</label>
              <input type="text" value={form.gc_name} onChange={e => setForm(p => ({ ...p, gc_name: e.target.value }))}
                placeholder="ABC Construction" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>GC Email</label>
              <input type="email" value={form.gc_email} onChange={e => setForm(p => ({ ...p, gc_email: e.target.value }))}
                placeholder="estimating@abc.com" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Contact Name</label>
              <input type="text" value={form.gc_contact_name} onChange={e => setForm(p => ({ ...p, gc_contact_name: e.target.value }))}
                placeholder="John Smith" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Contact Phone</label>
              <input type="tel" value={form.gc_contact_phone} onChange={e => setForm(p => ({ ...p, gc_contact_phone: e.target.value }))}
                placeholder="210-555-0100" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Submit To</label>
              <input type="text" value={form.submit_to} onChange={e => setForm(p => ({ ...p, submit_to: e.target.value }))}
                placeholder="email or portal" className={inputClass} />
            </div>
          </div>
        </div>

        {/* Deadline */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Bid Deadline</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Due Date</label>
              <input type="date" value={form.bid_due_date} onChange={e => setForm(p => ({ ...p, bid_due_date: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Due Time</label>
              <input type="text" value={form.bid_due_time} onChange={e => setForm(p => ({ ...p, bid_due_time: e.target.value }))}
                placeholder="2:00 PM CT" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inputClass}>
                {BID_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Trades */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider mb-3">Trades</h2>
          <div className="flex flex-wrap gap-2">
            {TRADES.map(t => (
              <button key={t} type="button" onClick={() => toggle(t)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  form.trades.includes(t)
                    ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]'
                    : 'border-gray-200 text-gray-600 hover:border-[#1a3a5c]'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <label className={labelClass}>Notes</label>
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            rows={3} placeholder="Any additional details..."
            className={inputClass + ' resize-none'} />
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 bg-[#1a3a5c] hover:bg-[#e87722] text-white font-bold px-6 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
            <Save size={14} /> {saving ? 'Saving…' : 'Save Bid'}
          </button>
          <Link href="/bids" className="border border-gray-200 text-gray-600 font-semibold px-6 py-2.5 rounded-lg text-sm hover:border-[#1a3a5c] transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
