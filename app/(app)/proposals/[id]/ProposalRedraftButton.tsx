'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2, Loader2 } from 'lucide-react';

interface Props {
  bidId: string | null;
  estimateId: string | null;
}

export default function ProposalRedraftButton({ bidId, estimateId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRedraft() {
    if (!bidId) { setError('No bid linked to this proposal.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/proposals/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid_id: bidId, estimate_id: estimateId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate proposal');
      router.push(`/proposals/${data.data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleRedraft}
        disabled={loading}
        className="btn btn-primary btn-sm w-full flex items-center justify-center gap-1.5"
      >
        {loading
          ? <><Loader2 size={13} className="animate-spin" /> Drafting…</>
          : <><Wand2 size={13} /> Re-draft with AI</>
        }
      </button>
      {error && (
        <p className="text-[11px] mt-1.5 text-center" style={{ color: 'var(--bad)' }}>{error}</p>
      )}
    </div>
  );
}
