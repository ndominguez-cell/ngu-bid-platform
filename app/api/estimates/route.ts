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

// Reading full plan sets with a high-capability model can take a while.
export const maxDuration = 300;

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

    // Load the actual drawings/specs so the model does a real takeoff instead
    // of guessing from filenames.
    const plans = await loadPlanDocuments(supabase, storage_paths as string[], file_names as string[]);
    if (plans.blocks.length === 0) {
      return NextResponse.json(
        {
          error:
            'Could not read any of the uploaded plan documents, so no estimate was generated. ' +
            `Skipped: ${plans.skipped.join('; ') || 'unknown'}`,
        },
        { status: 422 }
      );
    }

    // Pull bid context so the model knows the project scope and trades.
    let bidContext = '';
    if (bid_id) {
      const { data: bid } = await supabase
        .from('bids')
        .select('project_name, address, city, state, scope, trades, notes')
        .eq('id', bid_id)
        .eq('workspace_id', auth.workspaceId)
        .maybeSingle();
      if (bid) {
        bidContext = `Project: ${bid.project_name}
Location: ${[bid.address, bid.city, bid.state].filter(Boolean).join(', ') || 'Texas'}
Stated scope: ${bid.scope || 'see plans'}
Trades of interest: ${(bid.trades ?? []).join(', ') || 'site work / concrete / paving'}
GC notes: ${bid.notes || 'none'}`;
      }
    }

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
              text: `Prepare a detailed subcontractor bid takeoff for the following project. Base every quantity on the attached documents.\n\n${bidContext || 'No bid record — rely entirely on the attached documents.'}`,
            },
            ...plans.blocks,
          ],
        },
      ],
    });

    // Structured output: the response is a single text block of validated JSON.
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

    const lineItems = ai.line_items ?? [];
    const subtotal = lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const markup = typeof ai.markup_pct === 'number' ? ai.markup_pct : 10;
    const totalAmount = Math.round(subtotal * (1 + markup / 100));
    const notes = composeNotes(ai, plans);

    const { data: estimate, error: estError } = await supabase
      .from('estimates')
      .insert({
        workspace_id: auth.workspaceId,
        bid_id: bid_id || null,
        name: name || `Estimate – ${new Date().toLocaleDateString()}`,
        status: 'Draft',
        total_amount: totalAmount,
        markup_pct: markup,
        notes,
        ai_summary: ai.ai_summary || null,
        line_items: lineItems,
      })
      .select()
      .single();

    if (estError) return NextResponse.json({ error: estError.message }, { status: 500 });

    // Record only the documents that were actually analyzed.
    for (let i = 0; i < (storage_paths as string[]).length; i++) {
      const nm = (file_names as string[])[i] ?? (storage_paths[i] as string).split('/').pop();
      const { error: docErr } = await supabase.from('documents').insert({
        workspace_id: auth.workspaceId,
        bid_id: bid_id || null,
        estimate_id: estimate.id,
        name: nm,
        type: 'plans',
        storage_path: storage_paths[i],
        mime_type: (nm ?? '').toLowerCase().endsWith('.pdf') ? 'application/pdf' : null,
      });
      if (docErr) console.error('[estimates] document insert failed:', docErr.message);
    }

    return NextResponse.json({ ...estimate, documents_reviewed: plans.reviewed, documents_skipped: plans.skipped }, { status: 201 });
  } catch (err: unknown) {
    console.error('Estimate error:', err);
    const message = err instanceof Error ? err.message : 'Estimate generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
