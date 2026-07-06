'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, Info } from 'lucide-react';

export default function SettingsTabs() {
  const [defaultMarkup, setDefaultMarkup] = useState(10);
  const [defaultMargin, setDefaultMargin] = useState(8);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setDefaultMarkup(data.default_markup_pct);
          setDefaultMargin(data.default_margin_pct);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_markup_pct: defaultMarkup, default_margin_pct: defaultMargin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Markup & Margin Defaults */}
      <div className="card p-6">
        <h2 className="card-title mb-1">Markup & Margin Defaults</h2>
        <p className="text-[12px] mb-5" style={{ color: 'var(--text-muted)' }}>
          These percentages are applied as defaults when creating new estimates. They can be adjusted per estimate.
        </p>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="label-mono block mb-2">Default Markup %</label>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <input
                  type="number"
                  min={0} max={100} step={0.5}
                  value={defaultMarkup}
                  onChange={e => setDefaultMarkup(Number(e.target.value))}
                  className="w-20 text-[15px] font-semibold text-center outline-none px-3 py-2"
                  style={{ background: 'var(--surface)', color: 'var(--text)' }}
                />
                <span className="px-3 py-2 text-[13px]" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>%</span>
              </div>
              <div className="flex-1">
                <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Applied to subtotal before margin
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="label-mono block mb-2">Default Margin %</label>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <input
                  type="number"
                  min={0} max={100} step={0.5}
                  value={defaultMargin}
                  onChange={e => setDefaultMargin(Number(e.target.value))}
                  className="w-20 text-[15px] font-semibold text-center outline-none px-3 py-2"
                  style={{ background: 'var(--surface)', color: 'var(--text)' }}
                />
                <span className="px-3 py-2 text-[13px]" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>%</span>
              </div>
              <div className="flex-1">
                <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Applied after markup to final total
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="mt-5 rounded p-3 flex items-start gap-2.5 text-[12px]"
          style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
        >
          <Info size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">How these work</p>
            <p style={{ color: 'var(--text-2)' }}>
              New estimates start with these percentages. Each estimate can override them.
              Example: $100k subtotal with {defaultMarkup}% markup and {defaultMargin}% margin
              = ${((100000 * (1 + defaultMarkup / 100)) * (1 + defaultMargin / 100) / 1000).toFixed(0)}k total.
            </p>
          </div>
        </div>
      </div>

      {/* Trade List Defaults */}
      <div className="card p-6">
        <h2 className="card-title mb-1">Default Trade Categories</h2>
        <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>
          Manage the trade categories available when building estimates
        </p>
        <div className="flex flex-wrap gap-2">
          {['Concrete', 'Earthwork', 'Asphalt/Paving', 'Drainage', 'Utilities', 'Masonry', 'Structural Steel', 'Striping', 'Sitework', 'Other'].map(t => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium"
              style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Unit Defaults */}
      <div className="card p-6">
        <h2 className="card-title mb-1">Default Units</h2>
        <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>
          Common units for estimate line items
        </p>
        <div className="flex flex-wrap gap-2">
          {['SF', 'SY', 'CY', 'LF', 'EA', 'TON', 'GAL', 'HR', 'LS'].map(u => (
            <span
              key={u}
              className="inline-flex items-center rounded px-2.5 py-1 text-[12px] font-mono font-medium"
              style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
            >
              {u}
            </span>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3 justify-end">
        {error && <span className="text-[12px]" style={{ color: 'var(--bad)' }}>{error}</span>}
        {saved && <span className="text-[12px] font-semibold" style={{ color: 'var(--ok)' }}>Settings saved</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary flex items-center gap-1.5"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Save Estimating Settings'}
        </button>
      </div>
    </div>
  );
}
