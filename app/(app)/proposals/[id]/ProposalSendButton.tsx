'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';

interface ProposalSendButtonProps {
  proposalId: string;
  gcEmail: string | null;
  status: string;
}

export default function ProposalSendButton({ proposalId, gcEmail, status }: ProposalSendButtonProps) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  if (status === 'Sent') {
    return (
      <div className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2" style={{ color: 'var(--ok)' }}>
        <CheckCircle2 size={13} /> Sent via Gmail
      </div>
    );
  }

  if (!gcEmail) {
    return (
      <span className="text-[12px] px-3 py-2" style={{ color: 'var(--text-subtle)' }}>
        No recipient email on bid
      </span>
    );
  }

  async function handleSend() {
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/proposals/${proposalId}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Send failed');
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      <button
        onClick={handleSend}
        disabled={sending}
        className="btn btn-primary btn-sm w-full flex items-center justify-center gap-1.5"
      >
        {sending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
        {sending ? 'Sending…' : 'Send Now'}
      </button>
      {error && <p className="text-[11px] text-center" style={{ color: 'var(--bad)' }}>{error}</p>}
    </div>
  );
}
