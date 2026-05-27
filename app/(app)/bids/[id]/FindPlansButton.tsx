'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, CheckCircle2, AlertCircle, ExternalLink, FileText, ChevronDown, ChevronUp, Save } from 'lucide-react';

interface PlanFinderReport {
  result: 'Found complete docs' | 'Partial docs' | 'Gated only' | 'Not found';
  plans_url: string | null;
  confidence: 'high' | 'medium' | 'low';
  sources_checked: { url: string; status: string; notes?: string }[];
  search_queries_tried: string[];
  document_checklist: {
    drawings: string;
    specifications: string;
    addenda: string;
    bid_form: string;
  };
  recommended_next_step: string;
  notes: string;
  auto_saved?: boolean;
  error?: string;
}

const RESULT_STYLES = {
  'Found complete docs': { bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={14} className="text-green-600" /> },
  'Partial docs':        { bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', icon: <AlertCircle size={14} className="text-yellow-600" /> },
  'Gated only':          { bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700', icon: <AlertCircle size={14} className="text-orange-600" /> },
  'Not found':           { bg: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-600', icon: <AlertCircle size={14} className="text-gray-500" /> },
};

const STATUS_COLORS: Record<string, string> = {
  found: 'text-green-600',
  current: 'text-green-600',
  missing: 'text-red-500',
  unknown: 'text-gray-400',
};

export default function FindPlansButton({ bidId, hasPlansLink }: { bidId: string; hasPlansLink: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [report, setReport] = useState<PlanFinderReport | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [savingUrl, setSavingUrl] = useState('');

  async function handleFind() {
    setState('loading');
    setReport(null);
    try {
      const res = await fetch(`/api/bids/${bidId}/find-plans`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setReport(data);
      setState('done');
      setExpanded(true);
      if (data.auto_saved) router.refresh();
    } catch (err: unknown) {
      setState('error');
      setReport({ result: 'Not found', plans_url: null, confidence: 'low', sources_checked: [], search_queries_tried: [], document_checklist: { drawings: 'unknown', specifications: 'unknown', addenda: 'unknown', bid_form: 'unknown' }, recommended_next_step: '', notes: '', error: err instanceof Error ? err.message : 'Search failed' });
      setExpanded(true);
    }
  }

  async function saveUrl(url: string) {
    setSavingUrl(url);
    try {
      await fetch(`/api/bids/${bidId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans_link: url }),
      });
      router.refresh();
    } finally {
      setSavingUrl('');
    }
  }

  const resultStyle = report?.result ? RESULT_STYLES[report.result] ?? RESULT_STYLES['Not found'] : null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleFind}
          disabled={state === 'loading'}
          className="flex items-center gap-1.5 bg-[#1a3a5c] hover:bg-[#e87722] text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
        >
          {state === 'loading' ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Search size={13} />
          )}
          {state === 'loading' ? 'Searching public sources…' : hasPlansLink ? 'Search for More Plans' : 'Find Plans Online'}
        </button>

        {state === 'done' && report && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#1a3a5c] font-semibold transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Hide results' : 'Show results'}
          </button>
        )}
      </div>

      {state === 'loading' && (
        <p className="text-[11px] text-gray-400 mt-2">
          Searching Texas ESBD, municipal procurement pages, engineer sites, and public records…
        </p>
      )}

      {state !== 'idle' && state !== 'loading' && report && expanded && (
        <div className={`mt-3 rounded-xl border p-4 text-sm ${resultStyle?.bg ?? 'bg-gray-50 border-gray-200'}`}>
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            {resultStyle?.icon}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${resultStyle?.badge}`}>
              {report.result}
            </span>
            <span className={`text-[10px] font-semibold ml-auto ${report.confidence === 'high' ? 'text-green-600' : report.confidence === 'medium' ? 'text-yellow-600' : 'text-gray-400'}`}>
              {report.confidence} confidence
            </span>
          </div>

          {report.error && (
            <p className="text-xs text-red-600 mb-3">{report.error}</p>
          )}

          {/* Plans URL found */}
          {report.plans_url && (
            <div className="mb-3 p-3 bg-white rounded-lg border border-gray-200">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Plans URL Found</p>
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={report.plans_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[#e87722] font-semibold hover:underline flex-1 min-w-0 truncate"
                >
                  <ExternalLink size={11} />
                  {report.plans_url}
                </a>
                {!hasPlansLink && !report.auto_saved && (
                  <button
                    onClick={() => saveUrl(report.plans_url!)}
                    disabled={!!savingUrl}
                    className="flex items-center gap-1 bg-[#1a3a5c] hover:bg-[#e87722] text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors shrink-0 disabled:opacity-60"
                  >
                    {savingUrl ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                    Save to Bid
                  </button>
                )}
                {(report.auto_saved || hasPlansLink) && (
                  <span className="text-[10px] font-bold text-green-600">✓ Saved</span>
                )}
              </div>
            </div>
          )}

          {/* Document checklist */}
          {report.document_checklist && (
            <div className="mb-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Document Status</p>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(report.document_checklist).map(([doc, status]) => (
                  <div key={doc} className="flex items-center gap-1.5 text-[11px]">
                    <FileText size={10} className="text-gray-400 shrink-0" />
                    <span className="capitalize text-gray-600">{doc.replace('_', ' ')}</span>
                    <span className={`font-bold ml-auto ${STATUS_COLORS[status] ?? 'text-gray-400'}`}>
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sources checked */}
          {report.sources_checked && report.sources_checked.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Sources Checked</p>
              <div className="space-y-1">
                {report.sources_checked.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className={`font-bold shrink-0 ${s.status === 'useful' ? 'text-green-600' : s.status === 'gated' ? 'text-orange-500' : 'text-gray-400'}`}>
                      {s.status === 'useful' ? '✓' : s.status === 'gated' ? '🔒' : '—'}
                    </span>
                    <span className="text-gray-500 truncate">{s.url}</span>
                    {s.notes && <span className="text-gray-400 shrink-0">· {s.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended next step */}
          {report.recommended_next_step && (
            <div className="pt-2 border-t border-gray-200 mt-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Recommended Next Step</p>
              <p className="text-xs text-gray-600">{report.recommended_next_step}</p>
            </div>
          )}

          {/* Notes */}
          {report.notes && report.notes !== 'null' && (
            <p className="text-[11px] text-gray-500 mt-2 italic">{report.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
