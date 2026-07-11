import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import {
  FULL_ESTIMATE_INSTRUCTIONS,
  buildDocContentParts,
  guessMimeType,
  parseEstimateResponse,
} from '@/lib/estimate-ai';

export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const supabase = createServiceClient();

  try {
    const body = await req.json();
    const { storage_paths, file_names, bid_id, name } = body;

    if (!storage_paths?.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const contentParts = await buildDocContentParts(
      supabase,
      storage_paths as string[],
      (file_names ?? []) as string[]
    );
    contentParts.push({ type: 'text', text: FULL_ESTIMATE_INSTRUCTIONS });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: contentParts }],
    });

    // Throws a readable error on truncated/unparseable output — the estimate
    // is NOT saved in that case, so the UI shows the failure instead of an
    // empty $0 estimate.
    const estimateData = parseEstimateResponse(response);

    // Start from workspace-wide estimating defaults
    const { data: ws } = await supabase
      .from('workspaces')
      .select('default_markup_pct, default_margin_pct')
      .eq('id', auth.workspaceId)
      .maybeSingle();
    const wsMarkup = Number(ws?.default_markup_pct ?? 10);
    const wsMargin = Number(ws?.default_margin_pct ?? 8);

    const markupPct = estimateData.markup_pct ?? wsMarkup;
    const subtotal = (estimateData.line_items ?? []).reduce((sum, item) => sum + (item.total || 0), 0);
    const totalAmount = Math.round(subtotal * (1 + markupPct / 100) * (1 + wsMargin / 100));

    const { data: estimate, error: estError } = await supabase
      .from('estimates')
      .insert({
        workspace_id: auth.workspaceId,
        bid_id: bid_id || null,
        name: name || `Estimate – ${new Date().toLocaleDateString()}`,
        status: 'Draft',
        total_amount: totalAmount,
        markup_pct: markupPct,
        margin_pct: wsMargin,
        notes: estimateData.notes || null,
        ai_summary: estimateData.ai_summary || null,
        line_items: estimateData.line_items ?? [],
      })
      .select()
      .single();

    if (estError) return NextResponse.json({ error: estError.message }, { status: 500 });

    for (let i = 0; i < (storage_paths as string[]).length; i++) {
      const docName = (file_names as string[])[i] ?? (storage_paths[i] as string).split('/').pop();
      await supabase.from('documents').insert({
        workspace_id: auth.workspaceId,
        bid_id: bid_id || null,
        estimate_id: estimate.id,
        name: docName,
        type: 'plans',
        storage_path: storage_paths[i],
        mime_type: guessMimeType(docName ?? ''),
      });
    }

    return NextResponse.json({ ...estimate }, { status: 201 });

  } catch (err: unknown) {
    console.error('Estimate error:', err);
    const message = err instanceof Error ? err.message : 'Estimate generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
