import Anthropic, { toFile } from '@anthropic-ai/sdk';
import type { createServiceClient } from '@/lib/supabase/server';

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Accuracy is the priority for takeoffs, so the estimator runs on the most
// capable model. Centralised here so it can be changed in one place.
export const ESTIMATOR_MODEL = 'claude-opus-4-8';

// Anthropic beta required to reference uploaded plan files by id.
export const FILES_BETA = 'files-api-2025-04-14';

// Guards. Plan sets can be enormous; cap what we send and report the rest
// instead of silently truncating. Anthropic supports PDFs up to 32MB inline /
// 500MB via Files API, but token/context cost is the real limit — a few large
// drawing sets per estimate is the sweet spot.
const MAX_FILES = 15;
const MAX_TOTAL_BYTES = 60 * 1024 * 1024; // 60MB of plan documents per run

const PDF_MIME = 'application/pdf';
const IMAGE_MIMES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
};

function mimeFor(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return PDF_MIME;
  return IMAGE_MIMES[ext] ?? null;
}

export type PlanDocument =
  | { type: 'document'; source: { type: 'file'; file_id: string } }
  | { type: 'image'; source: { type: 'file'; file_id: string } };

export interface LoadedPlans {
  blocks: PlanDocument[];
  reviewed: string[];   // filenames actually sent to the model
  skipped: string[];    // filenames that could not be sent, with reason
}

/**
 * Download each plan file from the workspace's Storage bucket and upload it to
 * the Anthropic Files API so it can be passed to the model as a real document.
 *
 * This is the core accuracy fix: previously only filenames were sent, so every
 * quantity was invented. Now the model reads the actual drawings and specs.
 */
export async function loadPlanDocuments(
  serviceClient: ReturnType<typeof createServiceClient>,
  storagePaths: string[],
  fileNames: string[]
): Promise<LoadedPlans> {
  const blocks: PlanDocument[] = [];
  const reviewed: string[] = [];
  const skipped: string[] = [];
  let totalBytes = 0;

  for (let i = 0; i < storagePaths.length; i++) {
    const path = storagePaths[i];
    const name = fileNames[i] ?? path.split('/').pop() ?? `file-${i + 1}`;

    if (blocks.length >= MAX_FILES) {
      skipped.push(`${name} (over ${MAX_FILES}-document limit for one analysis)`);
      continue;
    }

    const mime = mimeFor(name);
    if (!mime) {
      skipped.push(`${name} (unsupported file type — upload PDF or image)`);
      continue;
    }

    const { data, error } = await serviceClient.storage.from('documents').download(path);
    if (error || !data) {
      skipped.push(`${name} (could not download from storage)`);
      continue;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    if (totalBytes + buffer.byteLength > MAX_TOTAL_BYTES) {
      skipped.push(`${name} (would exceed the ${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)}MB per-analysis limit)`);
      continue;
    }

    try {
      const uploaded = await anthropic.beta.files.upload({
        file: await toFile(buffer, name, { type: mime }),
        betas: [FILES_BETA],
      });
      totalBytes += buffer.byteLength;
      reviewed.push(name);
      if (mime === PDF_MIME) {
        blocks.push({ type: 'document', source: { type: 'file', file_id: uploaded.id } });
      } else {
        blocks.push({ type: 'image', source: { type: 'file', file_id: uploaded.id } });
      }
    } catch {
      skipped.push(`${name} (upload to analysis engine failed)`);
    }
  }

  return { blocks, reviewed, skipped };
}

// NGU only self-performs these trades; the model must not bid anything else.
export const NGU_TRADES =
  'Concrete (flatwork, foundations, walls, curbs & gutters), Earthwork (grading, excavation, fill, haul-off), ' +
  'Asphalt/Paving, Drainage, Utilities (water, sewer, storm), Masonry, Structural Steel, Striping, Sitework.';

export const ESTIMATOR_SYSTEM_PROMPT = `You are a senior construction estimator for NGU Construction, a Texas site work, concrete, and paving subcontractor. You are preparing a real subcontractor bid that will be submitted to a general contractor, so the numbers must reflect the actual documents — not assumptions.

NGU self-performs ONLY these trades — never bid anything outside them:
${NGU_TRADES}

BID PROTOCOL — follow it exactly:
1. TAKEOFF FROM THE DOCUMENTS. Read the attached drawings and specifications. Derive every quantity from what is actually shown: plan dimensions, civil/site plans, grading and paving plans, details, and quantity/schedule tables. Do NOT infer quantities from the file name or the project type — quantities come from the drawings.
2. TRACEABILITY. Every line item must be traceable to something in the documents. In each line item's "basis" field, cite where the quantity came from (e.g. "Sheet C-3 paving plan, scaled area" or "Concrete schedule, sheet S-2"). If you genuinely cannot determine a quantity from the provided documents, set qty to 0, put "TBD — not found in provided plans" in the description, and list the missing item under missing_documents. Never fabricate a quantity to fill a gap.
3. PRICING. Unit prices must reflect current (2025–2026) Texas market rates for a self-performing sub. Quantities come from the plans; only the unit rates come from market knowledge.
4. STANDARD ALLOWANCES. Apply normal, itemized allowances where the trade calls for it (e.g. concrete waste/shrinkage, earthwork swell/compaction, mobilization). State each allowance in the line item or assumptions — do not bury it invisibly in a unit price.
5. SCOPE HYGIENE. List exclusions (work NGU is NOT covering) and assumptions explicitly. Note any missing information that would materially change the bid (no geotechnical report, no addenda, illegible sheets, missing details).
6. CONFIDENCE. Report overall confidence: "high" only when the documents fully support the takeoff, "medium" when key sheets or details are missing, "low" when the documents are insufficient for a real takeoff.

Return only the structured object requested. total is computed from the line items downstream — you do not need to sum them.`;

// JSON Schema for structured output. line_items stays compatible with the
// EstimateLineItem shape the editor/CSV already read; extra fields are ignored
// by the UI but preserved in storage for auditability.
export const ESTIMATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ai_summary', 'line_items', 'markup_pct', 'confidence', 'assumptions', 'exclusions', 'missing_documents'],
  properties: {
    ai_summary: { type: 'string' },
    line_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['trade', 'description', 'qty', 'unit', 'unit_price', 'total', 'basis'],
        properties: {
          trade: { type: 'string' },
          description: { type: 'string' },
          qty: { type: 'number' },
          unit: { type: 'string' },
          unit_price: { type: 'number' },
          total: { type: 'number' },
          basis: { type: 'string', description: 'Where the quantity came from in the documents' },
        },
      },
    },
    markup_pct: { type: 'number' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    assumptions: { type: 'array', items: { type: 'string' } },
    exclusions: { type: 'array', items: { type: 'string' } },
    missing_documents: { type: 'array', items: { type: 'string' } },
  },
} as const;

export interface EstimateAI {
  ai_summary: string;
  line_items: Array<{ trade: string; description: string; qty: number; unit: string; unit_price: number; total: number; basis?: string }>;
  markup_pct: number;
  confidence: 'high' | 'medium' | 'low';
  assumptions: string[];
  exclusions: string[];
  missing_documents: string[];
}

/**
 * Fold the structured scope hygiene fields plus a record of which documents
 * were actually analyzed into the free-text notes stored on the estimate, so a
 * human reviewer sees confidence, exclusions, and any gaps at a glance.
 */
export function composeNotes(ai: EstimateAI, plans: LoadedPlans, priorNotes?: string | null): string {
  const parts: string[] = [];
  if (priorNotes) parts.push(priorNotes.trim());
  parts.push(`AI confidence: ${ai.confidence.toUpperCase()}`);
  parts.push(`Documents analyzed: ${plans.reviewed.length ? plans.reviewed.join(', ') : 'none'}`);
  if (plans.skipped.length) parts.push(`NOT analyzed: ${plans.skipped.join('; ')}`);
  if (ai.assumptions.length) parts.push(`Assumptions:\n- ${ai.assumptions.join('\n- ')}`);
  if (ai.exclusions.length) parts.push(`Exclusions:\n- ${ai.exclusions.join('\n- ')}`);
  if (ai.missing_documents.length) parts.push(`Missing / needs verification:\n- ${ai.missing_documents.join('\n- ')}`);
  return parts.join('\n\n');
}
