import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, Download, Sparkles, Send } from 'lucide-react';
import EstimateEditor from './EstimateEditor';
import EstimateUploadButton from './EstimateUploadButton';

export const revalidate = 0;

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Draft:       { bg: 'var(--surface-2)', color: 'var(--text-muted)' },
  'In Review': { bg: 'var(--info-soft)', color: 'var(--info)' },
  Approved:    { bg: 'var(--ok-soft)',   color: 'var(--ok)' },
  Submitted:   { bg: 'var(--warn-soft)', color: 'var(--warn)' },
  Archived:    { bg: 'var(--surface-2)', color: 'var(--text-subtle)' },
};

export default async function EstimateDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('estimates')
    .select('*, bids(project_name, city, state, gc_name, bid_due_date)')
    .eq('id', params.id)
    .single();

  if (error || !data) notFound();

  // Workspace-wide estimating defaults (RLS scopes this to the user's workspace)
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('default_markup_pct, default_margin_pct')
    .limit(1)
    .maybeSingle();
  const defaultMarkup = Number(workspace?.default_markup_pct ?? 10);
  const defaultMargin = Number(workspace?.default_margin_pct ?? 8);

  const est = data as {
    id: string;
    name: string;
    status: 'Draft' | 'In Review' | 'Approved' | 'Submitted' | 'Archived';
    total_amount: number | null;
    markup_pct: number;
    margin_pct: number | null;
    notes: string | null;
    ai_summary: string | null;
    line_items: Array<{ trade: string; description: string; qty: number; unit: string; unit_price: number; total: number }>;
    bid_id: string | null;
    created_at: string;
    updated_at: string | null;
    bids: { project_name: string; city?: string; state?: string; gc_name?: string } | null;
  };

  const statusStyle = STATUS_STYLES[est.status] ?? STATUS_STYLES.Draft;
  const shortId = est.id.slice(0, 8).toUpperCase();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back nav */}
      <Link
        href="/estimates"
        className="inline-flex items-center gap-1.5 text-[13px] mb-5 transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={13} />
        Estimates
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span
              className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded"
              style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}
            >
              EST-{shortId}
            </span>
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded"
              style={{ background: statusStyle.bg, color: statusStyle.color }}
            >
              {est.status}
            </span>
          </div>
          <h1 className="text-[22px] font-semibold leading-tight" style={{ color: 'var(--text)' }}>
            {est.name}
          </h1>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {est.bids && (
              <Link
                href={`/bids/${est.bid_id}`}
                className="text-[13px] font-medium transition-colors hover:opacity-80"
                style={{ color: 'var(--orange)' }}
              >
                {est.bids.project_name}
              </Link>
            )}
            {est.bids?.gc_name && (
              <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                {est.bids.gc_name}
              </span>
            )}
            <span className="text-[12px]" style={{ color: 'var(--text-subtle)' }}>
              {formatDate(est.created_at)}
            </span>
          </div>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2 shrink-0">
          <EstimateUploadButton estimateId={est.id} bidId={est.bid_id} />
          <a href={`/api/estimates/${est.id}/csv`}
            className="btn btn-ghost btn-sm flex items-center gap-1.5">
            <Download size={13} />
            Export CSV
          </a>
          {est.bid_id && (
            <a
              href={`/proposals/new?bid=${est.bid_id}&estimate=${est.id}`}
              className="btn btn-accent btn-sm flex items-center gap-1.5"
            >
              <Send size={13} />
              Generate Proposal
            </a>
          )}
        </div>
      </div>

      {/* AI Takeoff banner */}
      {est.ai_summary && (
        <div
          className="rounded-lg p-4 mb-5 flex gap-3"
          style={{
            background: 'linear-gradient(135deg, var(--info-soft) 0%, var(--navy-soft) 100%)',
            border: '1px solid var(--info-soft)',
          }}
        >
          <div
            className="mt-0.5 h-7 w-7 shrink-0 rounded-full grid place-items-center"
            style={{ background: 'var(--navy)', color: 'white' }}
          >
            <Sparkles size={13} />
          </div>
          <div>
            <p className="text-[12px] font-semibold mb-0.5" style={{ color: 'var(--navy)' }}>
              AI Plan Takeoff
            </p>
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
              {est.ai_summary}
            </p>
          </div>
        </div>
      )}

      <EstimateEditor
        key={`${est.id}-${est.updated_at ?? ''}`}
        estimateId={est.id}
        initialLineItems={est.line_items ?? []}
        initialMarkup={est.markup_pct ?? defaultMarkup}
        initialMargin={est.margin_pct ?? defaultMargin}
        initialStatus={est.status ?? 'Draft'}
        initialNotes={est.notes}
        bidId={est.bid_id}
        defaultMarkup={defaultMarkup}
        defaultMargin={defaultMargin}
      />
    </div>
  );
}
