'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import type { BidStatus } from '@/lib/types';

type Outcome = 'Won' | 'Lost' | 'Declined';

const LOSS_REASONS = [
  'Price too high',
  'Lost to incumbent / relationship',
  'Scope mismatch',
  'Submitted late',
  'Bonding / qualification',
  'Other',
];

const NOBID_REASONS = [
  'Outside our scope',
  'No capacity / timing',
  'Not profitable',
  'Plans unavailable',
  'Deadline missed',
  'Other',
];

const OPTIONS: { key: Outcome; label: string; color: string; soft: string }[] = [
  { key: 'Won', label: 'Won', color: 'var(--ok)', soft: 'var(--ok-soft)' },
  { key: 'Lost', label: 'Lost', color: 'var(--bad)', soft: 'var(--bad-soft)' },
  { key: 'Declined', label: 'No-bid', color: 'var(--text-muted)', soft: 'var(--surface-3)' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  background: 'var(--surface)',
  color: 'var(--text)',
};

function parseAmount(s: string): number | null {
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function BidOutcomePanel({
  bidId,
  status,
  ourBidAmount,
  awardedAmount,
  lossReason,
  decidedAt,
}: {
  bidId: string;
  status: BidStatus;
  ourBidAmount: number | null;
  awardedAmount: number | null;
  lossReason: string | null;
  decidedAt: string | null;
}) {
  const router = useRouter();
  const initial: Outcome | null =
    status === 'Won' || status === 'Lost' || status === 'Declined' ? status : null;

  const [outcome, setOutcome] = useState<Outcome | null>(initial);
  const [ourAmount, setOurAmount] = useState(ourBidAmount != null ? String(ourBidAmount) : '');
  const [winAmount, setWinAmount] = useState(awardedAmount != null ? String(awardedAmount) : '');
  const [reason, setReason] = useState(lossReason ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasons = outcome === 'Declined' ? NOBID_REASONS : LOSS_REASONS;

  async function handleSave() {
    if (!outcome) return;
    setSaving(true);
    setError(null);
    const payload = {
      outcome,
      our_bid_amount: outcome === 'Declined' ? null : parseAmount(ourAmount),
      awarded_amount:
        outcome === 'Won'
          ? parseAmount(ourAmount)
          : outcome === 'Lost'
            ? parseAmount(winAmount)
            : null,
      loss_reason: outcome === 'Won' ? null : reason || null,
    };
    const res = await fetch(`/api/bids/${bidId}/outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Could not save outcome');
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        {OPTIONS.map(o => {
          const active = outcome === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => setOutcome(o.key)}
              className="flex-1 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors"
              style={{
                borderColor: active ? o.color : 'var(--border)',
                background: active ? o.soft : 'var(--surface)',
                color: active ? o.color : 'var(--text-muted)',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {outcome && outcome !== 'Declined' && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label-mono">
              {outcome === 'Won' ? 'Our winning bid ($)' : 'Our bid amount ($)'}
            </label>
            <input
              value={ourAmount}
              onChange={e => setOurAmount(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 84500"
              className="mt-1.5"
              style={inputStyle}
            />
          </div>
          {outcome === 'Lost' && (
            <div>
              <label className="label-mono">Winning bid, if known ($)</label>
              <input
                value={winAmount}
                onChange={e => setWinAmount(e.target.value)}
                inputMode="decimal"
                placeholder="competitor's number"
                className="mt-1.5"
                style={inputStyle}
              />
            </div>
          )}
        </div>
      )}

      {outcome && outcome !== 'Won' && (
        <div className="mt-3">
          <label className="label-mono">Reason</label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="mt-1.5"
            style={inputStyle}
          >
            <option value="">Select a reason…</option>
            {reasons.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!outcome || saving}
          className="btn btn-accent btn-sm disabled:opacity-40"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Record outcome'}
        </button>
        {decidedAt && (
          <span className="text-[12px]" style={{ color: 'var(--text-subtle)' }}>
            Last decided {formatDate(decidedAt)}
          </span>
        )}
        {error && (
          <span className="text-[12px]" style={{ color: 'var(--bad)' }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
