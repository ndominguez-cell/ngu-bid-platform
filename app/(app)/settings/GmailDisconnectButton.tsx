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
        <span className="text-xs text-gray-500">Disconnect?</span>
        <button onClick={handleDisconnect} disabled={loading}
          className="text-xs text-red-500 hover:text-red-700 font-bold disabled:opacity-60">
          {loading ? <Loader2 size={11} className="animate-spin" /> : 'Yes'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-gray-400 hover:text-gray-600 font-semibold">
          No
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="text-xs text-red-400 hover:text-red-600 font-semibold transition-colors">
      Disconnect
    </button>
  );
}
