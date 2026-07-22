/** @typedef {'actual_cost' | 'approved_estimate' | 'supplier_quote' | 'public_bid_price'} ObservationKind */

export const OBSERVATION_KINDS = Object.freeze([
  'actual_cost',
  'approved_estimate',
  'supplier_quote',
  'public_bid_price',
]);

export const DEFAULT_COST_KINDS = Object.freeze([
  'actual_cost',
  'approved_estimate',
  'supplier_quote',
]);

const KIND_WEIGHTS = Object.freeze({
  actual_cost: 1,
  approved_estimate: 0.65,
  supplier_quote: 0.9,
  public_bid_price: 0.5,
});

const TRADE_ALIASES = new Map([
  ['concrete', 'Concrete'],
  ['flatwork', 'Concrete'],
  ['earthwork', 'Earthwork'],
  ['grading', 'Earthwork'],
  ['asphalt', 'Asphalt/Paving'],
  ['paving', 'Asphalt/Paving'],
  ['asphalt/paving', 'Asphalt/Paving'],
  ['drainage', 'Drainage'],
  ['utility', 'Utilities'],
  ['utilities', 'Utilities'],
  ['masonry', 'Masonry'],
  ['structural steel', 'Structural Steel'],
  ['striping', 'Striping'],
  ['site work', 'Sitework'],
  ['sitework', 'Sitework'],
]);

const UNIT_ALIASES = new Map([
  ['sf', 'SF'],
  ['sq ft', 'SF'],
  ['sqft', 'SF'],
  ['square foot', 'SF'],
  ['square feet', 'SF'],
  ['cy', 'CY'],
  ['cu yd', 'CY'],
  ['cuyd', 'CY'],
  ['cubic yard', 'CY'],
  ['cubic yards', 'CY'],
  ['lf', 'LF'],
  ['lin ft', 'LF'],
  ['linear foot', 'LF'],
  ['linear feet', 'LF'],
  ['ea', 'EA'],
  ['each', 'EA'],
  ['ton', 'TON'],
  ['tons', 'TON'],
  ['ls', 'LS'],
  ['lump sum', 'LS'],
  ['hr', 'HR'],
  ['hour', 'HR'],
  ['hours', 'HR'],
  ['day', 'DAY'],
  ['days', 'DAY'],
]);

function cleanText(value) {
  return typeof value === 'string'
    ? value.toLowerCase().replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
}

export function normalizeTrade(value) {
  return TRADE_ALIASES.get(cleanText(value)) ?? null;
}

export function normalizeUnit(value) {
  return UNIT_ALIASES.get(cleanText(value)) ?? null;
}

export function normalizeItemKey(value) {
  if (typeof value !== 'string') return null;
  const normalized = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || null;
}

function dateOnly(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/**
 * Convert a human-approved estimate into a complete, replay-safe evidence set.
 * Any invalid line makes V non-zero and blocks the entire publication so an
 * agent cannot silently learn from a partial estimate.
 *
 * @param {{
 *   workspaceId: string,
 *   estimateId: string,
 *   bidId?: string | null,
 *   lineItems: Array<{
 *     trade?: unknown,
 *     description?: unknown,
 *     qty?: unknown,
 *     unit?: unknown,
 *     unit_price?: unknown,
 *   }>,
 *   observedOn: string,
 *   createdBy?: string | null,
 * }} input
 */
export function buildApprovedEstimateObservations(input) {
  const issues = [];
  const observedOn = dateOnly(input.observedOn);
  const lineItems = Array.isArray(input.lineItems) ? input.lineItems : [];

  if (!input.workspaceId) issues.push({ field: 'workspaceId', reason: 'required' });
  if (!input.estimateId) issues.push({ field: 'estimateId', reason: 'required' });
  if (!observedOn) issues.push({ field: 'observedOn', reason: 'invalid_date' });
  if (lineItems.length === 0) issues.push({ field: 'lineItems', reason: 'at_least_one_required' });

  const rows = lineItems.map((line, index) => {
    const trade = normalizeTrade(line?.trade);
    const description = typeof line?.description === 'string' ? line.description.trim() : '';
    const itemKey = normalizeItemKey(description);
    const unit = normalizeUnit(line?.unit);
    const quantity = Number(line?.qty);
    const unitCost = Number(line?.unit_price);
    const lineNumber = index + 1;

    if (!trade) issues.push({ line: lineNumber, field: 'trade', reason: 'unsupported' });
    if (!itemKey) issues.push({ line: lineNumber, field: 'description', reason: 'required' });
    if (!unit) issues.push({ line: lineNumber, field: 'unit', reason: 'unsupported' });
    if (!Number.isFinite(quantity) || quantity <= 0) {
      issues.push({ line: lineNumber, field: 'qty', reason: 'must_be_positive' });
    }
    if (!Number.isFinite(unitCost) || unitCost <= 0) {
      issues.push({ line: lineNumber, field: 'unit_price', reason: 'must_be_positive' });
    }

    return {
      workspace_id: input.workspaceId,
      observation_kind: 'approved_estimate',
      source_name: 'ngu_estimate',
      source_ref: input.estimateId,
      source_line_ref: `line-${lineNumber}`,
      bid_id: input.bidId || null,
      estimate_id: input.estimateId,
      trade,
      item_key: itemKey,
      description,
      unit,
      quantity,
      unit_cost: unitCost,
      observed_on: observedOn,
      confidence: 0.65,
      provenance: {
        origin: 'approved_estimate',
        line_index: index,
        review_gate: 'estimate_status_approved',
      },
      created_by: input.createdBy || null,
    };
  });

  if (issues.length > 0) {
    return {
      status: 'blocked',
      V: issues.length,
      lineCount: lineItems.length,
      issues,
      rows: [],
    };
  }

  return {
    status: 'ready',
    V: 0,
    lineCount: rows.length,
    issues: [],
    rows,
  };
}

function clamp01(value, fallback = 0.5) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(1, Math.max(0, numeric));
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function weightedQuantile(points, quantile) {
  const sorted = [...points].sort((a, b) => a.value - b.value);
  const totalWeight = sorted.reduce((sum, point) => sum + point.weight, 0);
  const target = totalWeight * quantile;
  let cumulative = 0;

  for (const point of sorted) {
    cumulative += point.weight;
    if (cumulative >= target) return point.value;
  }

  return sorted.at(-1)?.value ?? 0;
}

/**
 * @typedef {object} CostObservation
 * @property {string} workspaceId
 * @property {ObservationKind} observationKind
 * @property {string} trade
 * @property {string} itemKey
 * @property {string} unit
 * @property {number} unitCost
 * @property {string} observedOn
 * @property {number=} confidence
 */

/**
 * Select exact comparables and return a recency/source-weighted robust range.
 * Public bid prices are excluded unless the caller explicitly allows them.
 *
 * @param {CostObservation[]} observations
 * @param {{
 *   workspaceId: string,
 *   trade: string,
 *   itemKey: string,
 *   unit: string,
 *   asOf?: string,
 *   allowedKinds?: ObservationKind[],
 *   minimumSamples?: number,
 *   halfLifeDays?: number,
 * }} input
 */
export function suggestUnitCost(observations, input) {
  const trade = normalizeTrade(input.trade);
  const itemKey = normalizeItemKey(input.itemKey);
  const unit = normalizeUnit(input.unit);
  const asOf = new Date(input.asOf ?? new Date().toISOString());
  const minimumSamples = Math.max(1, Math.floor(input.minimumSamples ?? 3));
  const halfLifeDays = Math.max(1, Number(input.halfLifeDays ?? 365));
  const allowedKinds = new Set(input.allowedKinds ?? DEFAULT_COST_KINDS);

  if (!input.workspaceId || !trade || !itemKey || !unit || Number.isNaN(asOf.getTime())) {
    return { status: 'invalid_context', reason: 'workspace, trade, item, unit, and date must be valid', sampleSize: 0 };
  }

  const points = [];
  const kindCounts = {};
  let newestObservedOn = null;

  for (const observation of observations) {
    if (observation.workspaceId !== input.workspaceId) continue;
    if (!allowedKinds.has(observation.observationKind)) continue;
    if (normalizeTrade(observation.trade) !== trade) continue;
    if (normalizeItemKey(observation.itemKey) !== itemKey) continue;
    if (normalizeUnit(observation.unit) !== unit) continue;

    const value = Number(observation.unitCost);
    const observedOn = new Date(observation.observedOn);
    if (!Number.isFinite(value) || value < 0 || Number.isNaN(observedOn.getTime())) continue;

    const ageDays = Math.max(0, (asOf.getTime() - observedOn.getTime()) / 86_400_000);
    if (observedOn.getTime() > asOf.getTime() + 86_400_000) continue;

    const sourceWeight = KIND_WEIGHTS[observation.observationKind] ?? 0;
    const confidence = clamp01(observation.confidence);
    const recencyWeight = 2 ** (-ageDays / halfLifeDays);
    const weight = sourceWeight * confidence * recencyWeight;
    if (weight <= 0) continue;

    points.push({ value, weight });
    kindCounts[observation.observationKind] = (kindCounts[observation.observationKind] ?? 0) + 1;
    const dateText = observedOn.toISOString().slice(0, 10);
    if (!newestObservedOn || dateText > newestObservedOn) newestObservedOn = dateText;
  }

  if (points.length < minimumSamples) {
    return {
      status: 'insufficient_evidence',
      reason: `fewer_than_${minimumSamples}_exact_comparables`,
      sampleSize: points.length,
    };
  }

  const suggestedUnitCost = weightedQuantile(points, 0.5);
  const low = weightedQuantile(points, 0.25);
  const high = weightedQuantile(points, 0.75);
  const effectiveWeight = points.reduce((sum, point) => sum + point.weight, 0);
  const spreadRatio = suggestedUnitCost > 0 ? (high - low) / suggestedUnitCost : high === low ? 0 : Infinity;
  const strength =
    points.length >= 10 && effectiveWeight >= 5 && spreadRatio <= 0.25
      ? 'high'
      : points.length >= 5 && effectiveWeight >= 2
        ? 'medium'
        : 'low';

  return {
    status: 'suggestion',
    trade,
    itemKey,
    unit,
    suggestedUnitCost: round(suggestedUnitCost),
    low: round(low),
    high: round(high),
    sampleSize: points.length,
    effectiveWeight: round(effectiveWeight, 3),
    newestObservedOn,
    observationKinds: kindCounts,
    strength,
  };
}
