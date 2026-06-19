'use client';

import { useState } from 'react';
import { Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function GmailImportButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleImport() {
    setState('loading');
    setMessage('');
    try {
      const res = await fetch('/api/gmail/detect-bids', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setMessage(data.message);
      setState('done');
      if (data.detected > 0) {
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setTimeout(() => setState('idle'), 4000);
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Import failed');
      setState('error');
      setTimeout(() => setState('idle'), 5000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span
          className="text-xs font-medium flex items-center gap-1"
          style={{ color: state === 'error' ? 'var(--bad)' : 'var(--ok)' }}
        >
          {state === 'error' ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
          {message}
        </span>
      )}
      <button
        onClick={handleImport}
        disabled={state === 'loading'}
        className="btn btn-sm flex items-center gap-1.5 disabled:opacity-60"
        title="Scan Gmail inbox for new bid invitations"
      >
        {state === 'loading' ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Mail size={13} />
        )}
        {state === 'loading' ? 'Scanning…' : 'Import from Gmail'}
      </button>
    </div>
  );
}
