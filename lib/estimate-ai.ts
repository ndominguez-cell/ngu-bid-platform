import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface EstimateLineItem {
  trade: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface ParsedEstimate {
  ai_summary?: string;
  line_items?: EstimateLineItem[];
  total_amount?: number;
  markup_pct?: number;
  notes?: string;
}

export const FULL_ESTIMATE_INSTRUCTIONS = `You are an expert construction estimator for NGU Construction, a Texas site work and concrete subcontractor.

Analyze the construction documents provided above and produce a detailed cost estimate.

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

Use current Texas market rates (2025-2026). Only include trades NGU performs. Extract quantities from the plan documents. Calculate total_amount as sum of line item totals times (1 + markup_pct/100).`;

export function guessMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  const img = lower.match(/\.(png|jpg|jpeg|gif|webp)$/);
  if (img) return img[1] === 'jpg' ? 'image/jpeg' : `image/${img[1]}`;
  return 'application/octet-stream';
}

export async function buildDocContentParts(
  supabase: SupabaseClient,
  storagePaths: string[],
  fileNames: (string | undefined)[],
): Promise<Anthropic.Messages.ContentBlockParam[]> {
  const contentParts: Anthropic.Messages.ContentBlockParam[] = [];

  for (let i = 0; i < storagePaths.length; i++) {
    const storagePath = storagePaths[i];
    const fileName = fileNames[i] ?? storagePath.split('/').pop() ?? `file-${i + 1}`;

    const { data: fileData, error: dlError } = await supabase.storage
      .from('documents')
      .download(storagePath);

    if (dlError || !fileData) {
      contentParts.push({ type: 'text', text: `File ${i + 1}: ${fileName} (could not download)` });
      continue;
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const base64 = buffer.toString('base64');
    const lowerName = fileName.toLowerCase();

    if (lowerName.endsWith('.pdf')) {
      contentParts.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      } as Anthropic.Messages.ContentBlockParam);
      contentParts.push({ type: 'text', text: `Above document is: ${fileName}` });
    } else if (lowerName.match(/\.(png|jpg|jpeg|gif|webp)$/)) {
      const ext = lowerName.split('.').pop()!;
      const mediaType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      contentParts.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 },
      });
      contentParts.push({ type: 'text', text: `Above image is: ${fileName}` });
    } else {
      contentParts.push({ type: 'text', text: `File ${i + 1}: ${fileName} (unsupported format)` });
    }
  }

  return contentParts;
}

// Extract and parse the JSON estimate from a model response. Throws a
// user-readable error when the response was truncated or unparseable, so
// callers surface the failure instead of silently saving an empty estimate.
export function parseEstimateResponse(response: Anthropic.Message): ParsedEstimate {
  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      'The AI ran out of room before finishing the estimate. Try again, or upload fewer documents at once (start with just the plan sheets).'
    );
  }

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  let text = rawText.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1];
  const match = text.match(/\{[\s\S]*\}/);

  try {
    return JSON.parse(match ? match[0] : text) as ParsedEstimate;
  } catch {
    throw new Error(
      'The AI response could not be read as an estimate. Try again, or upload fewer documents at once.'
    );
  }
}
