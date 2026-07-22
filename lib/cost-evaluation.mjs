import { suggestUnitCost } from './cost-observations.mjs';

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function mean(values) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function absolutePercentageError(predicted, actual) {
  if (!Number.isFinite(predicted) || !Number.isFinite(actual) || actual <= 0) return null;
  return Math.abs(predicted - actual) / actual;
}

/**
 * Evaluate cost suggestions against labeled cases and emit a deterministic
 * numeric receipt. V counts cases that violate their expected status,
 * accuracy ceiling, or baseline-improvement requirement.
 */
export function evaluateCostCases(dataset) {
  const cases = Array.isArray(dataset?.cases) ? dataset.cases : [];
  const results = [];
  const violations = [];
  const suggestionErrors = [];
  const baselineErrors = [];
  let expectedSuggestionCases = 0;
  let suggestionCases = 0;

  if (cases.length === 0) {
    violations.push({ id: 'dataset', reason: 'no_evaluation_cases' });
  }

  for (const evalCase of cases) {
    const expectedStatus = evalCase.expectedStatus ?? 'suggestion';
    const suggestion = suggestUnitCost(evalCase.observations ?? [], evalCase.query ?? {});
    const result = {
      id: evalCase.id,
      expectedStatus,
      actualStatus: suggestion.status,
      violation: null,
    };

    if (suggestion.status !== expectedStatus) {
      result.violation = `expected_${expectedStatus}_got_${suggestion.status}`;
    } else if (expectedStatus === 'suggestion') {
      expectedSuggestionCases += 1;
      suggestionCases += 1;
      const actualUnitCost = Number(evalCase.actualUnitCost);
      const baselineUnitCost = Number(evalCase.baselineUnitCost);
      const suggestionApe = absolutePercentageError(suggestion.suggestedUnitCost, actualUnitCost);
      const baselineApe = absolutePercentageError(baselineUnitCost, actualUnitCost);
      const maxApe = Number(evalCase.maxAbsolutePercentageError ?? 0.25);

      result.suggestedUnitCost = suggestion.suggestedUnitCost;
      result.actualUnitCost = actualUnitCost;
      result.baselineUnitCost = baselineUnitCost;
      result.suggestionApe = suggestionApe === null ? null : round(suggestionApe);
      result.baselineApe = baselineApe === null ? null : round(baselineApe);

      if (suggestionApe === null || baselineApe === null) {
        result.violation = 'invalid_accuracy_label';
      } else if (!Number.isFinite(maxApe) || maxApe < 0) {
        result.violation = 'invalid_accuracy_ceiling';
      } else {
        suggestionErrors.push(suggestionApe);
        baselineErrors.push(baselineApe);
        if (suggestionApe > maxApe) result.violation = 'accuracy_ceiling_exceeded';
        else if (evalCase.requireBaselineImprovement !== false && suggestionApe >= baselineApe) {
          result.violation = 'baseline_not_improved';
        }
      }
    }

    if (expectedStatus === 'suggestion' && suggestion.status !== 'suggestion') {
      expectedSuggestionCases += 1;
    }
    if (result.violation) violations.push({ id: evalCase.id, reason: result.violation });
    results.push(result);
  }

  if (cases.length > 0 && expectedSuggestionCases === 0) {
    violations.push({ id: 'dataset', reason: 'no_labeled_suggestion_cases' });
  }

  const suggestionMape = mean(suggestionErrors);
  const baselineMape = mean(baselineErrors);
  const relativeMapeImprovement =
    suggestionMape !== null && baselineMape !== null && baselineMape > 0
      ? (baselineMape - suggestionMape) / baselineMape
      : null;

  return {
    contract: 'm2-cost-suggestion-eval-v1',
    dataset: dataset?.name ?? 'unnamed',
    status: violations.length === 0 ? 'pass' : 'fail',
    V: violations.length,
    caseCount: cases.length,
    expectedSuggestionCases,
    suggestionCases,
    suggestionCoverage: expectedSuggestionCases > 0 ? round(suggestionCases / expectedSuggestionCases) : null,
    suggestionMape: suggestionMape === null ? null : round(suggestionMape),
    baselineMape: baselineMape === null ? null : round(baselineMape),
    relativeMapeImprovement: relativeMapeImprovement === null ? null : round(relativeMapeImprovement),
    violations,
    results,
  };
}
