import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { evaluateCostCases } from '../lib/cost-evaluation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function fixture() {
  return JSON.parse(await readFile(
    path.join(ROOT, 'tests/fixtures/m2-cost-evaluation.json'),
    'utf8',
  ));
}

test('synthetic M2 smoke set emits a passing numeric receipt', async () => {
  const receipt = evaluateCostCases(await fixture());

  assert.equal(receipt.contract, 'm2-cost-suggestion-eval-v1');
  assert.equal(receipt.status, 'pass');
  assert.equal(receipt.V, 0);
  assert.equal(receipt.caseCount, 4);
  assert.equal(receipt.suggestionCoverage, 1);
  assert.ok(receipt.suggestionMape < receipt.baselineMape);
  assert.ok(receipt.relativeMapeImprovement > 0);
});

test('a cost regression makes V non-zero and names the failed case', () => {
  const receipt = evaluateCostCases({
    name: 'regression-proof',
    cases: [{
      id: 'bad-suggestion',
      query: {
        workspaceId: 'workspace-a',
        trade: 'Concrete',
        itemKey: 'sidewalk',
        unit: 'SF',
        asOf: '2026-07-22T12:00:00.000Z',
      },
      observations: [20, 21, 22].map(unitCost => ({
        workspaceId: 'workspace-a',
        observationKind: 'actual_cost',
        trade: 'Concrete',
        itemKey: 'sidewalk',
        unit: 'SF',
        unitCost,
        observedOn: '2026-07-01',
        confidence: 1,
      })),
      actualUnitCost: 10,
      baselineUnitCost: 11,
      maxAbsolutePercentageError: 0.25,
    }],
  });

  assert.equal(receipt.status, 'fail');
  assert.equal(receipt.V, 1);
  assert.deepEqual(receipt.violations, [
    { id: 'bad-suggestion', reason: 'accuracy_ceiling_exceeded' },
  ]);
});

test('an empty evaluation dataset cannot pass with V zero', () => {
  const receipt = evaluateCostCases({ name: 'empty', cases: [] });

  assert.equal(receipt.status, 'fail');
  assert.equal(receipt.V, 1);
  assert.deepEqual(receipt.violations, [
    { id: 'dataset', reason: 'no_evaluation_cases' },
  ]);
});
