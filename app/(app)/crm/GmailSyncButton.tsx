'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2 } from 'lucide-react';

export default function GmailSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ synced?: number; contacts_found?: number; error?: string } | null>(null);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch('/api/gmail/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setResult(data);
      router.refresh();
    } catch (err: unknown) {
      setResult({ error: err instanceof Error ? err.message : 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && !result.error && (
        <span className="text-xs text-green-600 font-semibold">
          Synced {result.synced} threads · {result.contacts_found} contacts
        </span>
      )}
      {result?.error && (
        <span className="text-xs text-red-600">{result.error}</span>
      )}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-1.5 border border-[#1a3a5c] text-[#1a3a5c] text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
      >
        {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {syncing ? 'Syncing…' : 'Sync from Gmail'}
      </button>
    </div>
  );
}
