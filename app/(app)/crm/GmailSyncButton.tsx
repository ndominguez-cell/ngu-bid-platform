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
        <span className="text-xs font-semibold" style={{ color: 'var(--ok)' }}>
          Synced {result.synced} threads · {result.contacts_found} contacts
        </span>
      )}
      {result?.error && (
        <span className="text-xs" style={{ color: 'var(--bad)' }}>{result.error}</span>
      )}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="btn btn-sm flex items-center gap-1.5 disabled:opacity-60"
      >
        {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {syncing ? 'Syncing…' : 'Sync from Gmail'}
      </button>
    </div>
  );
}
