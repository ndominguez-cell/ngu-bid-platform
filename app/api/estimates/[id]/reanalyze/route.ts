import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import {
  anthropic,
  loadPlanDocuments,
  composeNotes,
  ESTIMATOR_MODEL,
  ESTIMATOR_SYSTEM_PROMPT,
  ESTIMATE_SCHEMA,
  FILES_BETA,
  type EstimateAI,
} from '@/lib/estimator';

export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const supabase = createServiceClient();

  try {
    const body = await req.json();
    const { storage_paths, file_names } = body as { storage_paths: string[]; file_names: string[] };

    if (!storage_paths?.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', params.id)
      .eq('workspace_id', auth.workspaceId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    const plans = await loadPlanDocuments(supabase, storage_paths, file_names);
    if (plans.blocks.length === 0) {
      return NextResponse.json(
        {
          error:
            'Could not read any of the newly uploaded plan documents. ' +
            `Skipped: ${plans.skipped.join('; ') || 'unknown'}`,
        },
        { status: 422 }
      );
    }

    const existingItems = (existing.line_items ?? []) as Array<{
      trade: string; description: string; qty: number; unit: string; unit_price: number; total: number;
    }>;
    const existingList = existingItems.length
      ? existingItems.map((li) => `- ${li.trade}: ${li.description} (${li.qty} ${li.unit})`).join('\n')
      : '(none yet)';
    const existingSummary = existing.ai_summary ? `\n\nExisting scope summary: ${existing.ai_summary}` : '';

    const response = await anthropic.beta.messages.create({
      model: ESTIMATOR_MODEL,
      max_tokens: 8000,
      betas: [FILES_BETA],
      system: [{ type: 'text', text: ESTIMATOR_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'high', format: { type: 'json_schema', schema: ESTIMATE_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Additional plan documents were uploaded for an existing estimate. Do a takeoff from the attached documents and return ONLY the NEW line items they add — do not repeat scope already covered below.\n\nExisting line items:\n${existingList}${existingSummary}`,
            },
            ...plans.blocks,
          ],
        },
      ],
    });

    const rawText = response.content.find((b) => b.type === 'text')?.text ?? '{}';
    let ai: EstimateAI;
    try {
      ai = JSON.parse(rawText) as EstimateAI;
    } catch {
      return NextResponse.json(
        { error: 'The analysis engine returned an unreadable result — please retry.' },
        { status: 502 }
      );
    }

    const mergedItems = [...existingItems, ...(ai.line_items ?? [])];
    const markup = existing.markup_pct ?? ai.markup_pct ?? 10;
    const subtotal = mergedItems.reduce((s, li) => s + (li.total || 0), 0);
    const totalAmount = Math.round(subtotal * (1 + markup / 100));
    const combinedSummary = [existing.ai_summary, ai.ai_summary].filter(Boolean).join(' | ');
    const combinedNotes = composeNotes(ai, plans, existing.notes);

    const { data: updated, error: updateErr } = await supabase
      .from('estimates')
      .update({
        line_items: mergedItems,
        total_amount: totalAmount,
        ai_summary: combinedSummary,
        notes: combinedNotes,
      })
      .eq('id', params.id)
      .eq('workspace_id', auth.workspaceId)
      .select()
      .single();

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    for (let i = 0; i < storage_paths.length; i++) {
      const nm = file_names[i] ?? storage_paths[i].split('/').pop();
      const { error: docErr } = await supabase.from('documents').insert({
        workspace_id: auth.workspaceId,
        bid_id: existing.bid_id || null,
        estimate_id: params.id,
        name: nm,
        type: 'plans',
        storage_path: storage_paths[i],
        mime_type: (nm ?? '').toLowerCase().endsWith('.pdf') ? 'application/pdf' : null,
      });
      if (docErr) console.error('[reanalyze] document insert failed:', docErr.message);
    }

    return NextResponse.json({ data: updated, documents_reviewed: plans.reviewed, documents_skipped: plans.skipped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Reanalysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
