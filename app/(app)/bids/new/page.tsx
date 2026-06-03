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

    const payload = {
      ...form,
      id: form.id || undefined,
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

  return (
    <div className="mx-auto w-full max-w-3xl px-7 pb-20 pt-6">
      <Link href="/bids" className="inline-flex items-center gap-1.5 text-[13px] mb-5 transition-colors" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft size={13} /> Bids
      </Link>
      <h1 className="text-[28px] font-medium leading-tight mb-1" style={{ color: 'var(--text)' }}>New Bid</h1>
      <p className="text-[13.5px] mb-6" style={{ color: 'var(--text-muted)' }}>Add a bid request manually</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Project */}
        <FormSection title="Project">
          <div className="col-span-2">
            <FieldLabel>Project Name *</FieldLabel>
            <FieldInput required value={form.project_name} onChange={e => setForm(p => ({ ...p, project_name: e.target.value }))}
              placeholder="e.g. Brake Masters McKinney" />
          </div>
          <div>
            <FieldLabel>Bid ID (optional)</FieldLabel>
            <FieldInput value={form.id} onChange={e => setForm(p => ({ ...p, id: e.target.value }))}
              placeholder="BID-2026-030" />
          </div>
          <div>
            <FieldLabel>Source</FieldLabel>
            <FieldSelect value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}>
              {['PlanHub','Procore','Novel','Direct','Other'].map(s => <option key={s}>{s}</option>)}
            </FieldSelect>
          </div>
          <div>
            <FieldLabel>Address</FieldLabel>
            <FieldInput value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
              placeholder="123 Main St" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>City</FieldLabel>
              <FieldInput value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="San Antonio" />
            </div>
            <div>
              <FieldLabel>State</FieldLabel>
              <FieldInput value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} placeholder="TX" />
            </div>
          </div>
          <div className="col-span-2">
            <FieldLabel>Scope of Work</FieldLabel>
            <FieldTextarea rows={3} value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))}
              placeholder="Describe the work NGU would perform…" />
          </div>
          <div className="col-span-2">
            <FieldLabel>Plans Link</FieldLabel>
            <FieldInput type="url" value={form.plans_link} onChange={e => setForm(p => ({ ...p, plans_link: e.target.value }))}
              placeholder="https://…" />
          </div>
        </FormSection>

        {/* GC */}
        <FormSection title="General Contractor">
          <div>
            <FieldLabel>GC / Company Name</FieldLabel>
            <FieldInput value={form.gc_name} onChange={e => setForm(p => ({ ...p, gc_name: e.target.value }))} placeholder="ABC Construction" />
          </div>
          <div>
            <FieldLabel>GC Email</FieldLabel>
            <FieldInput type="email" value={form.gc_email} onChange={e => setForm(p => ({ ...p, gc_email: e.target.value }))} placeholder="estimating@abc.com" />
          </div>
          <div>
            <FieldLabel>Contact Name</FieldLabel>
            <FieldInput value={form.gc_contact_name} onChange={e => setForm(p => ({ ...p, gc_contact_name: e.target.value }))} placeholder="John Smith" />
          </div>
          <div>
            <FieldLabel>Contact Phone</FieldLabel>
            <FieldInput type="tel" value={form.gc_contact_phone} onChange={e => setForm(p => ({ ...p, gc_contact_phone: e.target.value }))} placeholder="210-555-0100" />
          </div>
          <div>
            <FieldLabel>Submit To</FieldLabel>
            <FieldInput value={form.submit_to} onChange={e => setForm(p => ({ ...p, submit_to: e.target.value }))} placeholder="email or portal" />
          </div>
        </FormSection>

        {/* Deadline */}
        <FormSection title="Bid Deadline" cols={3}>
          <div>
            <FieldLabel>Due Date</FieldLabel>
            <FieldInput type="date" value={form.bid_due_date} onChange={e => setForm(p => ({ ...p, bid_due_date: e.target.value }))} />
          </div>
          <div>
            <FieldLabel>Due Time</FieldLabel>
            <FieldInput value={form.bid_due_time} onChange={e => setForm(p => ({ ...p, bid_due_time: e.target.value }))} placeholder="2:00 PM CT" />
          </div>
          <div>
            <FieldLabel>Status</FieldLabel>
            <FieldSelect value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              {BID_STATUSES.map(s => <option key={s}>{s}</option>)}
            </FieldSelect>
          </div>
        </FormSection>

        {/* Trades */}
        <div className="card p-5">
          <h2 className="card-title mb-3">Trades</h2>
          <div className="flex flex-wrap gap-2">
            {TRADES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => toggle(t)}
                className="text-[12px] font-semibold px-3 py-1.5 rounded border transition-colors"
                style={form.trades.includes(t)
                  ? { background: 'var(--navy)', color: 'white', borderColor: 'var(--navy)' }
                  : { background: 'transparent', color: 'var(--text-2)', borderColor: 'var(--border)' }
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="card p-5">
          <FieldLabel>Notes</FieldLabel>
          <FieldTextarea rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Any additional details…" />
        </div>

        {error && (
          <div
            className="text-[13px] rounded px-3 py-2"
            style={{ background: 'var(--bad-soft)', color: 'var(--bad)', border: '1px solid var(--bad-soft)' }}
          >
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-1.5">
            <Save size={14} /> {saving ? 'Saving…' : 'Save Bid'}
          </button>
          <Link href="/bids" className="btn btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function FormSection({ title, children, cols = 2 }: { title: string; children: React.ReactNode; cols?: number }) {
  return (
    <div className="card p-5 space-y-4">
      <h2 className="card-title">{title}</h2>
      <div className={`grid grid-cols-${cols} gap-4`}>{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="label-mono block mb-1">{children}</label>;
}

function FieldInput({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded border px-3 py-2 text-[13px] outline-none transition-colors ${className}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
      onFocus={e => (e.currentTarget.style.borderColor = 'var(--orange)')}
      onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      {...props}
    />
  );
}

function FieldSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="w-full rounded border px-3 py-2 text-[13px] outline-none transition-colors cursor-pointer"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
      {...props}
    >
      {children}
    </select>
  );
}

function FieldTextarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded border px-3 py-2 text-[13px] outline-none transition-colors resize-none ${className}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
      onFocus={e => (e.currentTarget.style.borderColor = 'var(--orange)')}
      onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      {...props}
    />
  );
}
