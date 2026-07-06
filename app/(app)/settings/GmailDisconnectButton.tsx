'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function GmailDisconnectButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDisconnect() {
    setLoading(true);
    try {
      await fetch('/api/profile', { method: 'DELETE' });
      router.refresh();
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Disconnect?</span>
        <button onClick={handleDisconnect} disabled={loading}
          className="text-xs font-bold disabled:opacity-60" style={{ color: 'var(--bad)' }}>
          {loading ? <Loader2 size={11} className="animate-spin" /> : 'Yes'}
        </button>
        <button onClick={() => setConfirming(false)}
          className="text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>
          No
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="text-xs font-semibold transition-colors" style={{ color: 'var(--bad)' }}>
      Disconnect
    </button>
  );
}
