'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Wand2 } from 'lucide-react';
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
    fetch('/api/bids').then(r => r.json()).then(d => {
      const bid = (d.data ?? []).find((b: any) => b.id === bidId);
      // We'll fetch estimates via bid detail
    });
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
      <div className="p-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={48} className="text-[#1a3a5c] animate-spin mb-6" />
        <h2 className="text-xl font-bold text-[#1a3a5c] mb-2">Drafting Proposal…</h2>
        <p className="text-gray-500 text-sm text-center max-w-md">
          Claude is writing a professional bid proposal email based on the bid details and estimate. Takes about 15 seconds.
        </p>
      </div>
    );
  }

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1a3a5c] transition-colors';
  const labelClass = 'block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1';

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link href="/proposals" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1a3a5c] mb-4 transition-colors">
        <ArrowLeft size={14} /> Back to Proposals
      </Link>
      <h1 className="text-2xl font-bold text-[#1a3a5c] mb-1">Draft Proposal</h1>
      <p className="text-gray-500 text-sm mb-6">Select a bid and Claude will write a professional proposal email</p>

      <form onSubmit={handleGenerate} className="space-y-5">
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <div>
            <label className={labelClass}>Bid *</label>
            <select value={bidId} onChange={e => setBidId(e.target.value)} className={inputClass} required>
              <option value="">— Select a bid —</option>
              {bids.map((b: any) => (
                <option key={b.id} value={b.id}>{b.id} · {b.project_name}</option>
              ))}
            </select>
          </div>

          {estimates.length > 0 && (
            <div>
              <label className={labelClass}>Estimate (optional — includes line item totals)</label>
              <select value={estimateId} onChange={e => setEstimateId(e.target.value)} className={inputClass}>
                <option value="">— No estimate (use TBD for amount) —</option>
                {estimates.map((est: any) => (
                  <option key={est.id} value={est.id}>{est.name} — ${est.total_amount?.toLocaleString()}</option>
                ))}
              </select>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            Claude will generate a professional email with: project scope, our bid total, key qualifications, and a signature block for Nick Dominguez at NGU Construction.
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

        <div className="flex gap-3">
          <button type="submit"
            className="flex items-center gap-2 bg-[#1a3a5c] hover:bg-[#e87722] text-white font-bold px-6 py-2.5 rounded-lg text-sm transition-colors">
            <Wand2 size={14} /> Generate with AI
          </button>
          <Link href="/proposals" className="border border-gray-200 text-gray-600 font-semibold px-6 py-2.5 rounded-lg text-sm hover:border-[#1a3a5c] transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NewProposalPage() {
  return (
    <Suspense fallback={
      <div className="p-6 flex items-center justify-center min-h-[40vh]">
        <Loader2 size={32} className="text-[#1a3a5c] animate-spin" />
      </div>
    }>
      <NewProposalContent />
    </Suspense>
  );
}
