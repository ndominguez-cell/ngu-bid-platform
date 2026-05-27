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
      <div className="flex items-center gap-1.5 text-xs text-green-600 font-semibold px-3 py-2">
        <CheckCircle2 size={13} /> Sent via Gmail
      </div>
    );
  }

  if (!gcEmail) {
    return (
      <span className="text-xs text-gray-400 px-3 py-2">No recipient email on bid</span>
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
    <div className="flex flex-col gap-1">
      <button
        onClick={handleSend}
        disabled={sending}
        className="flex items-center justify-center gap-1.5 w-full bg-[#1a3a5c] hover:bg-[#e87722] text-white text-xs font-bold py-2.5 rounded-lg transition-colors disabled:opacity-60"
      >
        {sending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
        {sending ? 'Sending…' : 'Send via Gmail'}
      </button>
      {error && <p className="text-[10px] text-red-600 text-center">{error}</p>}
    </div>
  );
}
