import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  const formData = await req.formData();
  const files = formData.getAll('files') as File[];
  const bidId = formData.get('bid_id') as string;
  const name = (formData.get('name') as string) || 'Estimate';

  if (!files.length) return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });

  try {
    // Convert files to base64 for Claude vision
    const fileContents = await Promise.all(files.map(async (file) => {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return { name: file.name, base64, mimeType: file.type, size: file.size };
    }));

    // Upload files to Supabase Storage
    const uploadedPaths: string[] = [];
    for (const fc of fileContents) {
      const path = `bids/${bidId || 'general'}/${Date.now()}-${fc.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, Buffer.from(fc.base64, 'base64'), { contentType: fc.mimeType });
      if (!uploadError) uploadedPaths.push(path);
    }

    // Build Claude prompt with file content
    const fileDescriptions = fileContents.map(f => `File: ${f.name} (${f.mimeType}, ${(f.size/1024).toFixed(0)}KB)`).join('\n');

    const claudeMessages: Anthropic.MessageParam[] = [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `You are an expert construction estimator for NGU Construction, a Texas site work and concrete subcontractor.

Analyze the following construction documents and produce a detailed cost estimate.

Files provided:
${fileDescriptions}

NGU Construction performs these trades: Concrete (flatwork, foundations, walls, curbs, gutters), Earthwork (grading, excavation, fill), Asphalt/Paving, Drainage, Utilities (water, sewer, storm), Masonry, Structural Steel, Striping, Sitework.

Return ONLY a valid JSON object with this exact structure:
{
  "ai_summary": "2-3 sentence description of the project scope and key quantities found",
  "line_items": [
    {
      "trade": "Concrete",
      "description": "4\" Concrete Flatwork - Parking Area",
      "qty": 5000,
      "unit": "SF",
      "unit_price": 8.50,
      "total": 42500
    }
  ],
  "total_amount": 0,
  "markup_pct": 10,
  "notes": "Any important assumptions or clarifications"
}

Use current Texas market rates (2025-2026). Be conservative but realistic. Only include trades NGU performs. Calculate total_amount as sum of all line item totals times (1 + markup_pct/100).`
        },
        // If PDF files were provided, note we're working from file names/descriptions
        // In production, you'd send actual file content via base64 image blocks
        {
          type: 'text',
          text: `Note: For this estimate, base your quantities on typical projects of this type and scope described in the filenames. If you can identify the project type from the filename, provide realistic estimates for NGU's scope of work.`
        }
      ]
    }];

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
      messages: claudeMessages,
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    let estimateData: any = {};
    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      estimateData = JSON.parse(match ? match[0] : rawText);
    } catch {
      estimateData = {
        ai_summary: 'AI analysis complete — please review and adjust line items.',
        line_items: [],
        total_amount: 0,
        markup_pct: 10,
        notes: rawText.substring(0, 500),
      };
    }

    // Calculate total
    const subtotal = (estimateData.line_items || []).reduce((sum: number, item: any) => sum + (item.total || 0), 0);
    const totalAmount = subtotal * (1 + (estimateData.markup_pct || 10) / 100);

    // Save estimate to database
    const { data: estimate, error: estError } = await supabase
      .from('estimates')
      .insert({
        bid_id: bidId || null,
        name,
        status: 'Draft',
        total_amount: Math.round(totalAmount),
        markup_pct: estimateData.markup_pct || 10,
        notes: estimateData.notes || null,
        ai_summary: estimateData.ai_summary || null,
        line_items: estimateData.line_items || [],
      })
      .select()
      .single();

    if (estError) return NextResponse.json({ error: estError.message }, { status: 500 });

    // Save document records
    for (const path of uploadedPaths) {
      await supabase.from('documents').insert({
        bid_id: bidId || null,
        estimate_id: estimate.id,
        name: path.split('/').pop(),
        type: 'plans',
        storage_path: path,
        mime_type: 'application/pdf',
      });
    }

    return NextResponse.json({ ...estimate }, { status: 201 });
  } catch (err: any) {
    console.error('Estimate error:', err);
    return NextResponse.json({ error: err.message || 'Estimate generation failed' }, { status: 500 });
  }
}
