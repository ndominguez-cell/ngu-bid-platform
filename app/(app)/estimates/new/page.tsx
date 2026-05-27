'use client';

import { Suspense, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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
    setFiles(prev => [...prev, ...dropped]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) { setError('Please upload at least one file.'); return; }
    setError('');

    // Step 1: Upload files directly to Supabase Storage via signed URLs
    setStep('uploading');
    const storagePaths: string[] = [];
    const fileNames: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Uploading file ${i + 1} of ${files.length}: ${file.name}`);

      try {
        // Get signed upload token from server (service role creates it)
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

        // Upload directly to Supabase Storage via SDK (bypasses Vercel size limits)
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

    // Step 2: Call estimates API with storage paths (small JSON payload — no file size limit)
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
      <div className="p-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={48} className="text-[#1a3a5c] animate-spin mb-6" />
        <h2 className="text-xl font-bold text-[#1a3a5c] mb-2">Uploading Files…</h2>
        <p className="text-gray-500 text-sm text-center max-w-md">{uploadProgress}</p>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="p-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={48} className="text-[#1a3a5c] animate-spin mb-6" />
        <h2 className="text-xl font-bold text-[#1a3a5c] mb-2">Analyzing Plans…</h2>
        <p className="text-gray-500 text-sm text-center max-w-md">
          Claude is reading your uploaded documents, identifying scope and quantities, and building your line-item estimate. This takes 30–60 seconds.
        </p>
      </div>
    );
  }

  if (step === 'review' && result) {
    const lineItems = result.line_items ?? [];
    const totalAmount = result.total_amount ?? 0;
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <CheckCircle2 size={24} className="text-green-500" />
          <div>
            <h1 className="text-xl font-bold text-[#1a3a5c]">Estimate Created</h1>
            <p className="text-sm text-gray-500">Review, edit, and approve below</p>
          </div>
        </div>

        {result.ai_summary && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-sm text-blue-800">
            <p className="font-bold mb-1">AI Takeoff Summary</p>
            <p className="whitespace-pre-wrap">{result.ai_summary}</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1a3a5c] uppercase tracking-wider">Line Items</h2>
            <span className="text-sm font-bold text-[#1a3a5c]">
              Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(totalAmount)}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Trade</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Description</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Unit</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Unit Price</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lineItems.map((item: { trade: string; description: string; qty: number; unit: string; unit_price: number; total: number }, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs font-medium text-purple-700 bg-purple-50/50">{item.trade}</td>
                  <td className="px-4 py-2.5 text-gray-700">{item.description}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{item.qty?.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-gray-500">{item.unit}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">${item.unit_price?.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-[#1a3a5c]">${item.total?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3">
          <button onClick={() => router.push(`/estimates/${result.id}`)}
            className="bg-[#1a3a5c] hover:bg-[#e87722] text-white font-bold px-6 py-2.5 rounded-lg text-sm transition-colors">
            View &amp; Edit Full Estimate →
          </button>
          <button onClick={() => router.push('/estimates')}
            className="border border-gray-200 text-gray-600 font-semibold px-6 py-2.5 rounded-lg text-sm hover:border-[#1a3a5c] transition-colors">
            Back to Estimates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#1a3a5c] mb-1">New Estimate</h1>
      <p className="text-gray-500 text-sm mb-6">Upload plans or specs — Claude will extract quantities and build a line-item estimate</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* File drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            dragging ? 'border-[#1a3a5c] bg-blue-50' : 'border-gray-200 hover:border-[#1a3a5c] hover:bg-gray-50'
          }`}
        >
          <Upload size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="font-semibold text-gray-600">Drop plans, specs, or documents here</p>
          <p className="text-xs text-gray-400 mt-1">PDF or images · Multiple files OK · Any size</p>
          <input ref={fileRef} type="file" multiple accept=".pdf,image/*" className="hidden"
            onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-1.5">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <FileText size={14} className="text-[#1a3a5c]" />
                <span className="text-sm text-gray-700 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
                <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                  className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Bid ID (optional)</label>
            <input type="text" value={bidIdInput} onChange={e => setBidIdInput(e.target.value)}
              placeholder="BID-2026-001"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1a3a5c]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Estimate Name</label>
            <input type="text" value={estimateName} onChange={e => setEstimateName(e.target.value)}
              placeholder="e.g. Base Bid Estimate"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1a3a5c]" />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <button type="submit"
          className="w-full bg-[#1a3a5c] hover:bg-[#e87722] text-white font-bold py-3 rounded-xl transition-colors text-sm">
          Upload &amp; Generate Estimate with AI
        </button>
      </form>
    </div>
  );
}

export default function NewEstimatePage() {
  return (
    <Suspense fallback={
      <div className="p-6 max-w-2xl mx-auto flex items-center justify-center min-h-[40vh]">
        <Loader2 size={32} className="text-[#1a3a5c] animate-spin" />
      </div>
    }>
      <NewEstimateContent />
    </Suspense>
  );
}
