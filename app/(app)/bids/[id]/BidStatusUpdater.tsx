'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BID_STATUSES, STATUS_COLORS } from '@/lib/utils';
import type { BidStatus } from '@/lib/types';

export default function BidStatusUpdater({ bidId, currentStatus }: { bidId: string; currentStatus: BidStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<BidStatus>(currentStatus);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/bids/${bidId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
  }

  return (
    <div className="space-y-2">
      <select
        value={status}
        onChange={e => setStatus(e.target.value as BidStatus)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1a3a5c] transition-colors"
      >
        {BID_STATUSES.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <button
        onClick={handleSave}
        disabled={saving || status === currentStatus}
        className="w-full bg-[#1a3a5c] hover:bg-[#e87722] text-white text-xs font-bold py-2 rounded-lg transition-colors disabled:opacity-40"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Update Status'}
      </button>
    </div>
  );
}
