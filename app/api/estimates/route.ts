import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();

  try {
    const body = await req.json();
    const { storage_paths, file_names, bid_id, name } = body;

    if (!storage_paths?.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const fileDescriptions = (file_names as string[])
      .map((n: string, i: number) => `File ${i + 1}: ${n}`)
      .join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `You are an expert construction estimator for NGU Construction, a Texas site work and concrete subcontractor.

Analyze the following construction documents and produce a detailed cost estimate.

Files provided:
${fileDescriptions}

NGU Construction performs these trades: Concrete (flatwork, foundations, walls, curbs, gutters), Earthwork (grading, excavation, fill), Asphalt/Paving, Drainage, Utilities (water, sewer, storm), Masonry, Structural Steel, Striping, Sitework.

Return ONLY a valid JSON object — no extra text, no markdown, just JSON:
{
  "ai_summary": "2-3 sentence description of the project scope and key quantities found",
  "line_items": [
    {
      "trade": "Concrete",
      "description": "4 inch Concrete Flatwork - Parking Area",
      "qty": 5000,
      "unit": "SF",
      "unit_price": 8.50,
      "total": 42500
    }
  ],
  "total_amount": 0,
  "markup_pct": 10,
  "notes": "Key assumptions or exclusions"
}

Use current Texas market rates (2025-2026). Only include trades NGU performs. Base quantities on the project type inferred from filenames. Calculate total_amount as sum of line item totals times (1 + markup_pct/100).`,
      }],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    let estimateData: {
      ai_summary?: string;
      line_items?: Array<{ trade: string; description: string; qty: number; unit: string; unit_price: number; total: number }>;
      total_amount?: number;
      markup_pct?: number;
      notes?: string;
    } = {};

    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      estimateData = JSON.parse(match ? match[0] : rawText);
    } catch {
      estimateData = {
        ai_summary: 'AI analysis complete — review and adjust line items below.',
        line_items: [],
        total_amount: 0,
        markup_pct: 10,
        notes: rawText.substring(0, 500),
      };
    }

    const subtotal = (estimateData.line_items ?? []).reduce((sum, item) => sum + (item.total || 0), 0);
    const totalAmount = Math.round(subtotal * (1 + (estimateData.markup_pct ?? 10) / 100));

    const { data: estimate, error: estError } = await supabase
      .from('estimates')
      .insert({
        bid_id: bid_id || null,
        name: name || `Estimate – ${new Date().toLocaleDateString()}`,
        status: 'Draft',
        total_amount: totalAmount,
        markup_pct: estimateData.markup_pct ?? 10,
        notes: estimateData.notes || null,
        ai_summary: estimateData.ai_summary || null,
        line_items: estimateData.line_items ?? [],
      })
      .select()
      .single();

    if (estError) return NextResponse.json({ error: estError.message }, { status: 500 });

    for (let i = 0; i < (storage_paths as string[]).length; i++) {
      await supabase.from('documents').insert({
        bid_id: bid_id || null,
        estimate_id: estimate.id,
        name: (file_names as string[])[i] ?? (storage_paths[i] as string).split('/').pop(),
        type: 'plans',
        storage_path: storage_paths[i],
        mime_type: 'application/pdf',
      });
    }

    return NextResponse.json({ ...estimate }, { status: 201 });

  } catch (err: unknown) {
    console.error('Estimate error:', err);
    const message = err instanceof Error ? err.message : 'Estimate generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
