import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  normalizeItemKey,
  normalizeTrade,
  normalizeUnit,
  suggestUnitCost,
} from '../lib/cost-observations.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AS_OF = '2026-07-18T12:00:00.000Z';

function observation(overrides = {}) {
  return {
    workspaceId: 'workspace-a',
    observationKind: 'actual_cost',
    trade: 'Concrete',
    itemKey: 'sidewalk-4-inch',
    unit: 'SF',
    unitCost: 10,
    observedOn: '2026-07-01',
    confidence: 1,
    ...overrides,
  };
}

test('normalizes only supported trades and units into stable keys', () => {
  assert.equal(normalizeTrade(' grading '), 'Earthwork');
  assert.equal(normalizeTrade('asphalt'), 'Asphalt/Paving');
  assert.equal(normalizeTrade('unknown trade'), null);
  assert.equal(normalizeUnit('square feet'), 'SF');
  assert.equal(normalizeUnit('Cu. Yd.'), 'CY');
  assert.equal(normalizeUnit('meters'), null);
  assert.equal(normalizeItemKey(' 4" Sidewalk & Curb '), '4-sidewalk-and-curb');
});

test('suggestion uses exact workspace, trade, item, and unit comparables', () => {
  const result = suggestUnitCost([
    observation({ unitCost: 8 }),
    observation({ unitCost: 10, observationKind: 'approved_estimate' }),
    observation({ unitCost: 12, observationKind: 'approved_estimate' }),
    observation({ workspaceId: 'workspace-b', unitCost: 999 }),
    observation({ unit: 'CY', unitCost: 500 }),
    observation({ itemKey: 'curb-and-gutter', unitCost: 50 }),
    observation({ observationKind: 'public_bid_price', unitCost: 100 }),
  ], {
    workspaceId: 'workspace-a',
    trade: 'flatwork',
    itemKey: 'Sidewalk 4 inch',
    unit: 'sq ft',
    asOf: AS_OF,
  });

  assert.equal(result.status, 'suggestion');
  assert.equal(result.sampleSize, 3);
  assert.equal(result.suggestedUnitCost, 10);
  assert.deepEqual(result.observationKinds, { actual_cost: 1, approved_estimate: 2 });
});

test('recent actual costs outweigh stale comparables', () => {
  const result = suggestUnitCost([
    observation({ unitCost: 5, observedOn: '2021-01-01' }),
    observation({ unitCost: 6, observedOn: '2021-06-01' }),
    observation({ unitCost: 10, observedOn: '2026-07-17' }),
  ], {
    workspaceId: 'workspace-a',
    trade: 'Concrete',
    itemKey: 'sidewalk-4-inch',
    unit: 'SF',
    asOf: AS_OF,
  });

  assert.equal(result.status, 'suggestion');
  assert.equal(result.suggestedUnitCost, 10);
  assert.equal(result.newestObservedOn, '2026-07-17');
});

test('returns an explicit reason when evidence is insufficient', () => {
  const result = suggestUnitCost([
    observation({ unitCost: 8 }),
    observation({ unitCost: 10 }),
  ], {
    workspaceId: 'workspace-a',
    trade: 'Concrete',
    itemKey: 'sidewalk-4-inch',
    unit: 'SF',
    asOf: AS_OF,
  });

  assert.deepEqual(result, {
    status: 'insufficient_evidence',
    reason: 'fewer_than_3_exact_comparables',
    sampleSize: 2,
  });
});

test('public bid prices require explicit opt-in and remain labeled', () => {
  const publicRows = [9, 11, 13].map(unitCost => observation({
    observationKind: 'public_bid_price',
    unitCost,
  }));

  const defaultResult = suggestUnitCost(publicRows, {
    workspaceId: 'workspace-a',
    trade: 'Concrete',
    itemKey: 'sidewalk-4-inch',
    unit: 'SF',
    asOf: AS_OF,
  });
  assert.equal(defaultResult.status, 'insufficient_evidence');

  const marketResult = suggestUnitCost(publicRows, {
    workspaceId: 'workspace-a',
    trade: 'Concrete',
    itemKey: 'sidewalk-4-inch',
    unit: 'SF',
    asOf: AS_OF,
    allowedKinds: ['public_bid_price'],
  });
  assert.equal(marketResult.status, 'suggestion');
  assert.equal(marketResult.suggestedUnitCost, 11);
  assert.deepEqual(marketResult.observationKinds, { public_bid_price: 3 });
});

test('cost-observation schema is workspace-private and service-write-only', async () => {
  const sql = (await readFile(
    path.join(ROOT, 'supabase/migrations/20260718120000_cost_observations.sql'),
    'utf8',
  )).replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ');

  assert.match(sql, /workspace_id uuid not null references public\.workspaces/);
  assert.match(sql, /using \(private\.is_workspace_member\(workspace_id\)\)/);
  assert.match(sql, /revoke all on table public\.cost_observations from anon, authenticated/);
  assert.match(sql, /grant select on table public\.cost_observations to authenticated/);
  assert.doesNotMatch(sql, /create policy [^;]+ for (all|insert|update|delete) to authenticated/);
  assert.match(sql, /'actual_cost'.*'approved_estimate'.*'supplier_quote'.*'public_bid_price'/);
});
