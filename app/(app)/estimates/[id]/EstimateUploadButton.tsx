'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  estimateId: string;
  bidId: string | null;
}

export default function EstimateUploadButton({ estimateId, bidId }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  async function handleFiles(incoming: File[]) {
    const valid = incoming.filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'));
    if (!valid.length) { setError('Please select PDF or image files.'); return; }

    setUploading(true);
    setError('');
    const storagePaths: string[] = [];
    const fileNames: string[] = [];

    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      setProgress(`Uploading ${i + 1}/${valid.length}: ${file.name}`);
      try {
        const presignRes = await fetch('/api/estimates/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, mimeType: file.type, bidId }),
        });
        if (!presignRes.ok) throw new Error('Failed to get upload URL');
        const { path, token } = await presignRes.json();

        const supabase = createClient();
        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .uploadToSignedUrl(path, token, file, { contentType: file.type || 'application/octet-stream' });
        if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

        storagePaths.push(path);
        fileNames.push(file.name);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        setUploading(false);
        setProgress('');
        return;
      }
    }

    setProgress('Analyzing new plans with AI…');
    try {
      const res = await fetch(`/api/estimates/${estimateId}/reanalyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_paths: storagePaths, file_names: fileNames }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reanalysis failed');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setUploading(false);
      setProgress('');
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => !uploading && fileRef.current?.click()}
        disabled={uploading}
        className="btn btn-ghost btn-sm flex items-center gap-1.5"
        title={uploading ? progress : 'Upload additional plans'}
      >
        {uploading
          ? <><Loader2 size={13} className="animate-spin" /> {progress || 'Uploading…'}</>
          : <><Upload size={13} /> Upload Plans</>
        }
      </button>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,image/*"
        className="hidden"
        onChange={e => handleFiles(Array.from(e.target.files ?? []))}
      />
      {error && (
        <div
          className="absolute top-full mt-1 right-0 text-[11px] rounded px-2 py-1 whitespace-nowrap z-10"
          style={{ background: 'var(--bad-soft)', color: 'var(--bad)', border: '1px solid var(--bad-soft)' }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
