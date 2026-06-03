'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Wand2, Sparkles } from 'lucide-react';
import Link from 'next/link';

function NewProposalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultBidId = searchParams.get('bid') ?? '';
  const defaultEstimateId = searchParams.get('estimate') ?? '';

  const [bidId, setBidId] = useState(defaultBidId);
  const [estimateId, setEstimateId] = useState(defaultEstimateId);
  const [bids, setBids] = useState<any[]>([]);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/bids').then(r => r.json()).then(d => setBids(d.data ?? []));
  }, []);

  useEffect(() => {
    if (!bidId) { setEstimates([]); return; }
    fetch(`/api/bids/${bidId}`).then(r => r.json()).then(d => {
      setEstimates(d.data?.estimates ?? []);
    });
  }, [bidId]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!bidId) { setError('Please select a bid.'); return; }
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
    } catch (err: any) {
      setError(err.message || 'Failed to generate proposal');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-7 pb-20 pt-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative mb-5">
          <Loader2 size={40} className="animate-spin" style={{ color: 'var(--navy)' }} />
          <Sparkles size={16} className="absolute -top-1 -right-1" style={{ color: 'var(--orange)' }} />
        </div>
        <h2 className="text-[18px] font-semibold mb-2" style={{ color: 'var(--text)' }}>Drafting Proposal…</h2>
        <p className="text-[13px] text-center max-w-md" style={{ color: 'var(--text-muted)' }}>
          Claude is writing a professional bid proposal email based on the bid details and estimate. Takes about 15 seconds.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-7 pb-20 pt-6">
      <Link href="/proposals" className="inline-flex items-center gap-1.5 text-[13px] mb-5 transition-colors" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft size={13} /> Proposals
      </Link>
      <h1 className="text-[28px] font-medium leading-tight mb-1" style={{ color: 'var(--text)' }}>Draft Proposal</h1>
      <p className="text-[13.5px] mb-6" style={{ color: 'var(--text-muted)' }}>
        Select a bid and Claude will write a professional proposal email
      </p>

      <form onSubmit={handleGenerate} className="space-y-5">
        <div className="card p-5 space-y-4">
          <div>
            <label className="label-mono block mb-1">Bid *</label>
            <select
              value={bidId}
              onChange={e => setBidId(e.target.value)}
              required
              className="w-full rounded border px-3 py-2 text-[13px] outline-none transition-colors cursor-pointer"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <option value="">— Select a bid —</option>
              {bids.map((b: any) => (
                <option key={b.id} value={b.id}>{b.id} · {b.project_name}</option>
              ))}
            </select>
          </div>

          {estimates.length > 0 && (
            <div>
              <label className="label-mono block mb-1">Estimate (optional — includes line item totals)</label>
              <select
                value={estimateId}
                onChange={e => setEstimateId(e.target.value)}
                className="w-full rounded border px-3 py-2 text-[13px] outline-none transition-colors cursor-pointer"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                <option value="">— No estimate (use TBD for amount) —</option>
                {estimates.map((est: any) => (
                  <option key={est.id} value={est.id}>{est.name} — ${est.total_amount?.toLocaleString()}</option>
                ))}
              </select>
            </div>
          )}

          {/* AI context note */}
          <div
            className="rounded-lg p-3 text-[12px]"
            style={{
              background: 'linear-gradient(135deg, var(--info-soft) 0%, var(--navy-soft) 100%)',
              border: '1px solid var(--border)',
              color: 'var(--info)',
            }}
          >
            <p className="font-semibold mb-0.5 flex items-center gap-1.5">
              <Sparkles size={12} /> What Claude will generate
            </p>
            <p style={{ color: 'var(--text-2)' }}>
              A professional proposal email with: project scope, our bid total, key qualifications, and a signature block for Nick Dominguez at NGU Construction.
            </p>
          </div>
        </div>

        {error && (
          <div
            className="text-[13px] rounded px-3 py-2"
            style={{ background: 'var(--bad-soft)', color: 'var(--bad)', border: '1px solid var(--bad-soft)' }}
          >
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" className="btn btn-accent flex items-center gap-1.5">
            <Wand2 size={14} /> Generate with AI
          </button>
          <Link href="/proposals" className="btn btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

export default function NewProposalPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto w-full max-w-2xl px-7 pb-20 pt-6 flex items-center justify-center min-h-[40vh]">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--navy)' }} />
      </div>
    }>
      <NewProposalContent />
    </Suspense>
  );
}
