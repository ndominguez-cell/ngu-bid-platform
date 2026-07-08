import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import {
  FULL_ESTIMATE_INSTRUCTIONS,
  buildDocContentParts,
  guessMimeType,
  parseEstimateResponse,
  type EstimateLineItem,
} from '@/lib/estimate-ai';

export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Static system prompt — cached on first call, ~90% cheaper on subsequent calls.
const APPEND_SYSTEM_PROMPT = `You are an expert construction estimator for NGU Construction, a Texas site work and concrete subcontractor.

When additional plan files are uploaded for an existing estimate, analyze the new documents and generate ADDITIONAL or UPDATED line items only — do not repeat items already in the estimate.

NGU Construction trades: Concrete, Earthwork, Asphalt/Paving, Drainage, Utilities, Masonry, Structural Steel, Striping, Sitework.

Always return ONLY a valid JSON object with this exact shape:
{
  "ai_summary": "Brief description of what the new documents added or clarified",
  "line_items": [
    {
      "trade": "Concrete",
      "description": "Additional scope from new plans",
      "qty": 1000,
      "unit": "SF",
      "unit_price": 8.50,
      "total": 8500
    }
  ],
  "markup_pct": 10,
  "notes": "Any new assumptions or exclusions"
}

Use current Texas market rates (2025-2026). Do not include markdown, explanation, or any text outside the JSON object.`;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'AI is not configured: ANTHROPIC_API_KEY is missing from the deployment environment variables.' },
      { status: 500 }
    );
  }

  const supabase = createServiceClient();

  try {
    // The "Re-evaluate Plan via AI" button posts with no body at all —
    // treat that the same as an empty body.
    const body = (await req.json().catch(() => ({}))) as {
      storage_paths?: string[];
      file_names?: string[];
    };
    const newPaths = body.storage_paths ?? [];
    const newNames = body.file_names ?? [];

    const { data: existing, error: fetchErr } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', params.id)
      .eq('workspace_id', auth.workspaceId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    const existingItems = (existing.line_items ?? []) as EstimateLineItem[];
    const markup = Number(existing.markup_pct ?? 10);
    const margin = Number(existing.margin_pct ?? 8);

    let updatePayload: Record<string, unknown>;

    if (newPaths.length > 0) {
      // New files uploaded: analyze just those and APPEND their line items.
      const contentParts = await buildDocContentParts(supabase, newPaths, newNames);
      const existingSummary = existing.ai_summary ? `\n\nExisting scope summary: ${existing.ai_summary}` : '';
      contentParts.push({
        type: 'text',
        text: `New files uploaded above.${existingSummary}\n\nExisting line item count: ${existingItems.length}\n\nGenerate only NEW line items not already represented.`,
      });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: [{ type: 'text', text: APPEND_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: contentParts }],
      });

      const newData = parseEstimateResponse(response);
      const mergedItems = [...existingItems, ...(newData.line_items ?? [])];
      const subtotal = mergedItems.reduce((s, li) => s + (li.total || 0), 0);

      updatePayload = {
        line_items: mergedItems,
        total_amount: Math.round(subtotal * (1 + markup / 100) * (1 + margin / 100)),
        ai_summary: [existing.ai_summary, newData.ai_summary].filter(Boolean).join(' | ') || null,
        notes: [existing.notes, newData.notes].filter(Boolean).join('\n') || null,
      };
    } else {
      // No new files: re-run the full takeoff over every document already
      // attached to this estimate and REPLACE the line items.
      const { data: docs } = await supabase
        .from('documents')
        .select('name, storage_path')
        .eq('estimate_id', params.id)
        .eq('workspace_id', auth.workspaceId)
        .order('created_at', { ascending: true });

      if (!docs?.length) {
        return NextResponse.json(
          { error: 'No documents are attached to this estimate yet — upload plans first.' },
          { status: 400 }
        );
      }

      const contentParts = await buildDocContentParts(
        supabase,
        docs.map(d => d.storage_path),
        docs.map(d => d.name)
      );
      contentParts.push({ type: 'text', text: FULL_ESTIMATE_INSTRUCTIONS });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{ role: 'user', content: contentParts }],
      });

      const newData = parseEstimateResponse(response);
      const items = newData.line_items ?? [];
      const subtotal = items.reduce((s, li) => s + (li.total || 0), 0);

      updatePayload = {
        line_items: items,
        total_amount: Math.round(subtotal * (1 + markup / 100) * (1 + margin / 100)),
        ai_summary: newData.ai_summary || existing.ai_summary,
        notes: newData.notes || existing.notes,
      };
    }

    const { data: updated, error: updateErr } = await supabase
      .from('estimates')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('workspace_id', auth.workspaceId)
      .select()
      .single();

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    for (let i = 0; i < newPaths.length; i++) {
      const docName = newNames[i] ?? newPaths[i].split('/').pop();
      await supabase.from('documents').insert({
        workspace_id: auth.workspaceId,
        bid_id: existing.bid_id || null,
        estimate_id: params.id,
        name: docName,
        type: 'plans',
        storage_path: newPaths[i],
        mime_type: guessMimeType(docName ?? ''),
      });
    }

    return NextResponse.json({ data: updated });
  } catch (err: unknown) {
    console.error('[reanalyze] error:', err);
    const message = err instanceof Error ? err.message : 'Reanalysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
