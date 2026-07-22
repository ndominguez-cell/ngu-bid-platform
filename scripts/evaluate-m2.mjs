import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateCostCases } from '../lib/cost-evaluation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datasetPath = path.resolve(ROOT, process.argv[2] ?? 'tests/fixtures/m2-cost-evaluation.json');

try {
  const dataset = JSON.parse(await readFile(datasetPath, 'utf8'));
  const receipt = evaluateCostCases(dataset);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (receipt.V > 0) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
