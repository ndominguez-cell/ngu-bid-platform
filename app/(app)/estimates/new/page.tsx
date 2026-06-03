'use client';

import { Suspense, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

type Step = 'upload' | 'uploading' | 'processing' | 'review';

function NewEstimateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bidId = searchParams.get('bid');

  const [step, setStep] = useState<Step>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [bidIdInput, setBidIdInput] = useState(bidId ?? '');
  const [estimateName, setEstimateName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      f.type === 'application/pdf' || f.type.startsWith('image/')
    );
    handleFileChange(dropped);
  }

  const MAX_FILE_SIZE = 102_400_000;

  function handleFileChange(incoming: File[]) {
    const tooBig = incoming.filter(f => f.size > MAX_FILE_SIZE);
    if (tooBig.length) {
      setError(`File too large: ${tooBig.map(f => f.name).join(', ')} — max 100,000 KB per file`);
      return;
    }
    setError('');
    setFiles(prev => [...prev, ...incoming]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) { setError('Please upload at least one file.'); return; }
    setError('');

    setStep('uploading');
    const storagePaths: string[] = [];
    const fileNames: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Uploading file ${i + 1} of ${files.length}: ${file.name}`);

      try {
        const presignRes = await fetch('/api/estimates/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, mimeType: file.type, bidId: bidIdInput }),
        });
        if (!presignRes.ok) {
          const err = await presignRes.json();
          throw new Error(err.error || 'Failed to get upload URL');
        }
        const { path, token } = await presignRes.json();

        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .uploadToSignedUrl(path, token, file, {
            contentType: file.type || 'application/octet-stream',
          });
        if (uploadError) throw new Error(`Upload failed for ${file.name}: ${uploadError.message}`);

        storagePaths.push(path);
        fileNames.push(file.name);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        setStep('upload');
        return;
      }
    }

    setStep('processing');
    setUploadProgress('');

    try {
      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_paths: storagePaths,
          file_names: fileNames,
          bid_id: bidIdInput,
          name: estimateName || `Estimate – ${new Date().toLocaleDateString()}`,
        }),
      });

      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(`Server error: ${text.substring(0, 200)}`);
      }
      if (!res.ok) throw new Error((data.error as string) || `Error ${res.status}`);
      setResult(data);
      setStep('review');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Estimate generation failed';
      setError(message);
      setStep('upload');
    }
  }

  if (step === 'uploading') {
    return (
      <div className="mx-auto w-full max-w-2xl px-7 pb-20 pt-6 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={40} className="animate-spin mb-5" style={{ color: 'var(--navy)' }} />
        <h2 className="text-[18px] font-semibold mb-2" style={{ color: 'var(--text)' }}>Uploading Files…</h2>
        <p className="text-[13px] text-center max-w-md" style={{ color: 'var(--text-muted)' }}>{uploadProgress}</p>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="mx-auto w-full max-w-2xl px-7 pb-20 pt-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative mb-5">
          <Loader2 size={40} className="animate-spin" style={{ color: 'var(--navy)' }} />
          <Sparkles size={16} className="absolute -top-1 -right-1" style={{ color: 'var(--orange)' }} />
        </div>
        <h2 className="text-[18px] font-semibold mb-2" style={{ color: 'var(--text)' }}>Analyzing Plans…</h2>
        <p className="text-[13px] text-center max-w-md" style={{ color: 'var(--text-muted)' }}>
          Claude is reading your uploaded documents, identifying scope and quantities, and building your line-item estimate. This takes 30–60 seconds.
        </p>
      </div>
    );
  }

  if (step === 'review' && result) {
    const lineItems = result.line_items ?? [];
    const totalAmount = result.total_amount ?? 0;
    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

    return (
      <div className="mx-auto w-full max-w-4xl px-7 pb-20 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <CheckCircle2 size={22} style={{ color: 'var(--ok)' }} />
          <div>
            <h1 className="text-[22px] font-semibold" style={{ color: 'var(--text)' }}>Estimate Created</h1>
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Review, edit, and approve below</p>
          </div>
        </div>

        {result.ai_summary && (
          <div
            className="rounded-lg p-4 mb-5 text-[13px]"
            style={{ background: 'var(--info-soft)', border: '1px solid var(--info-soft)', color: 'var(--info)' }}
          >
            <p className="font-semibold mb-1 flex items-center gap-1.5"><Sparkles size={13} /> AI Takeoff Summary</p>
            <p className="whitespace-pre-wrap">{result.ai_summary}</p>
          </div>
        )}

        <div className="card overflow-hidden p-0 mb-5">
          <div className="card-head flex items-center justify-between">
            <h2 className="card-title">Line Items</h2>
            <span className="text-[13px] font-semibold" style={{ color: 'var(--navy)' }}>Total: {fmt(totalAmount)}</span>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Trade', 'Description', 'Qty', 'Unit', 'Unit Price', 'Total'].map(h => (
                  <th key={h} className={`px-4 py-2.5 label-mono ${h === 'Qty' || h === 'Unit Price' || h === 'Total' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item: { trade: string; description: string; qty: number; unit: string; unit_price: number; total: number }, i: number) => (
                <tr key={i} className="transition-colors hover:bg-[var(--surface-2)]" style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-2.5">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded"
                      style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}
                    >
                      {item.trade}
                    </span>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text)' }}>{item.description}</td>
                  <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text-2)' }}>{item.qty?.toLocaleString()}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>{item.unit}</td>
                  <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text-2)' }}>${item.unit_price?.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color: 'var(--navy)' }}>${item.total?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3">
          <button onClick={() => router.push(`/estimates/${result.id}`)} className="btn btn-primary">
            View &amp; Edit Full Estimate →
          </button>
          <Link href="/estimates" className="btn btn-ghost">Back to Estimates</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-7 pb-20 pt-6">
      <Link href="/estimates" className="inline-flex items-center gap-1.5 text-[13px] mb-5 transition-colors" style={{ color: 'var(--text-muted)' }}>
        ← Estimates
      </Link>
      <h1 className="text-[28px] font-medium leading-tight mb-1" style={{ color: 'var(--text)' }}>New Estimate</h1>
      <p className="text-[13.5px] mb-6" style={{ color: 'var(--text-muted)' }}>
        Upload plans or specs — Claude will extract quantities and build a line-item estimate
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="rounded-xl p-10 text-center cursor-pointer transition-all"
          style={{
            border: `2px dashed ${dragging ? 'var(--navy)' : 'var(--border)'}`,
            background: dragging ? 'var(--navy-soft)' : 'var(--surface)',
          }}
        >
          <Upload size={30} className="mx-auto mb-3" style={{ color: 'var(--border-strong)' }} />
          <p className="font-semibold text-[13px]" style={{ color: 'var(--text-2)' }}>Drop plans, specs, or documents here</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-subtle)' }}>PDF or images · Multiple files OK · Max 100,000 KB per file</p>
          <input ref={fileRef} type="file" multiple accept=".pdf,image/*" className="hidden"
            onChange={e => handleFileChange(Array.from(e.target.files ?? []))} />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-1.5">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <FileText size={13} style={{ color: 'var(--navy)' }} />
                <span className="text-[13px] flex-1 truncate" style={{ color: 'var(--text)' }}>{f.name}</span>
                <span className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                  {f.size >= 1_048_576 ? `${(f.size / 1_048_576).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`}
                </span>
                <button
                  type="button"
                  onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                  className="text-[16px] leading-none transition-colors hover:text-[var(--bad)]"
                  style={{ color: 'var(--text-subtle)' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-mono block mb-1">Bid ID (optional)</label>
            <input
              type="text"
              value={bidIdInput}
              onChange={e => setBidIdInput(e.target.value)}
              placeholder="BID-2026-001"
              className="w-full rounded border px-3 py-2 text-[13px] outline-none transition-colors"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--orange)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>
          <div>
            <label className="label-mono block mb-1">Estimate Name</label>
            <input
              type="text"
              value={estimateName}
              onChange={e => setEstimateName(e.target.value)}
              placeholder="e.g. Base Bid Estimate"
              className="w-full rounded border px-3 py-2 text-[13px] outline-none transition-colors"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--orange)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>
        </div>

        {error && (
          <div
            className="text-[13px] rounded px-3 py-2 flex items-start gap-2"
            style={{ background: 'var(--bad-soft)', color: 'var(--bad)', border: '1px solid var(--bad-soft)' }}
          >
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary w-full flex items-center justify-center gap-2">
          <Sparkles size={14} /> Upload &amp; Generate Estimate with AI
        </button>
      </form>
    </div>
  );
}

export default function NewEstimatePage() {
  return (
    <Suspense fallback={
      <div className="mx-auto w-full max-w-2xl px-7 pb-20 pt-6 flex items-center justify-center min-h-[40vh]">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--navy)' }} />
      </div>
    }>
      <NewEstimateContent />
    </Suspense>
  );
}
