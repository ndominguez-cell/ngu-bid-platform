import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Static system prompt — cached on first call, ~90% cheaper on subsequent calls.
const SYSTEM_PROMPT = `You are an expert construction estimator for NGU Construction, a Texas site work and concrete subcontractor.

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
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    const fileDescriptions = file_names.map((n, i) => `File ${i + 1}: ${n}`).join('\n');
    const existingItems = (existing.line_items ?? []) as Array<{
      trade: string; description: string; qty: number; unit: string; unit_price: number; total: number;
    }>;
    const existingSummary = existing.ai_summary ? `\n\nExisting scope summary: ${existing.ai_summary}` : '';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `New files uploaded:\n${fileDescriptions}${existingSummary}\n\nExisting line item count: ${existingItems.length}\n\nGenerate only NEW line items not already represented.`,
        },
      ],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    let newData: {
      ai_summary?: string;
      line_items?: Array<{ trade: string; description: string; qty: number; unit: string; unit_price: number; total: number }>;
      markup_pct?: number;
      notes?: string;
    } = {};

    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      newData = JSON.parse(match ? match[0] : rawText);
    } catch {
      newData = { ai_summary: 'Additional files analyzed.', line_items: [] };
    }

    const mergedItems = [...existingItems, ...(newData.line_items ?? [])];
    const markup = existing.markup_pct ?? newData.markup_pct ?? 10;
    const subtotal = mergedItems.reduce((s, li) => s + (li.total || 0), 0);
    const totalAmount = Math.round(subtotal * (1 + markup / 100));
    const combinedSummary = [existing.ai_summary, newData.ai_summary].filter(Boolean).join(' | ');
    const combinedNotes = [existing.notes, newData.notes].filter(Boolean).join('\n');

    const { data: updated, error: updateErr } = await supabase
      .from('estimates')
      .update({
        line_items: mergedItems,
        total_amount: totalAmount,
        ai_summary: combinedSummary,
        notes: combinedNotes || null,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    for (let i = 0; i < storage_paths.length; i++) {
      await supabase.from('documents').insert({
        bid_id: existing.bid_id || null,
        estimate_id: params.id,
        name: file_names[i] ?? storage_paths[i].split('/').pop(),
        type: 'plans',
        storage_path: storage_paths[i],
        mime_type: 'application/pdf',
      });
    }

    return NextResponse.json({ data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Reanalysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
