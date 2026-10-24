import { cases, conditions, reviewFields } from './cases.mjs';

export function validateRun(run) {
  if (!conditions.includes(run.condition)) throw new Error('condition must be A, B or C');
  if (!['live', 'manual', 'fixture'].includes(run.mode)) throw new Error('mode must be live, manual or fixture');
  for (const key of ['runId', 'model', 'modelSettings', 'promptVersion', 'appVersion']) {
    if (typeof run[key] !== 'string' || !run[key].trim()) throw new Error(`Missing metadata: ${key}`);
  }
  if (!Array.isArray(run.responses)) throw new Error('responses must be an array');
  const seen = new Set();
  for (const r of run.responses) {
    if (!cases.some(c => c.id === r.caseId) || seen.has(r.caseId)) throw new Error(`Unknown or duplicate case: ${r.caseId}`);
    seen.add(r.caseId);
    if (typeof r.answer !== 'string' || !r.facts || typeof r.facts !== 'object' || Array.isArray(r.facts)) throw new Error('Each response needs answer text and a facts object');
    for (const field of reviewFields) {
      const value = r.review?.[field];
      if (value != null && (!Number.isInteger(value) || value < 0 || (field !== 'unsupportedClaims' && value > 2))) throw new Error(`Invalid review value: ${field}`);
    }
    if (reviewFields.some(f => r.review?.[f] != null) && (!r.review.reviewer?.trim() || !r.review.notes?.trim())) throw new Error('Human reviews require reviewer and evidence notes');
  }
}

export function scoreRun(run) {
  validateRun(run);
  const rows = cases.map(c => {
    const r = run.responses.find(r => r.caseId === c.id);
    const answered = Boolean(r?.answer.trim());
    const checks = Object.entries(c.expected).map(([field, expected]) => ({ field, expected, actual: r?.facts?.[field], passed: answered && Object.hasOwn(r.facts, field) && Object.is(r.facts[field], expected) }));
    return { caseId: c.id, answered, checks, review: answered ? r.review ?? null : null };
  });
  const checks = rows.flatMap(r => r.checks);
  return {
    runId: run.runId, condition: run.condition, mode: run.mode,
    warning: 'Structured fact checks do not verify all prose, UI behavior, sources, or customer learning. Human review is required. Fixture runs are not bot evaluations.',
    answeredCases: rows.filter(r => r.answered).length, totalCases: cases.length,
    factChecksPassed: checks.filter(c => c.passed).length, factChecksTotal: checks.length,
    factAccuracy: checks.filter(c => c.passed).length / checks.length,
    humanReview: Object.fromEntries(reviewFields.map(field => {
      const values = rows.map(r => r.review?.[field]).filter(v => v != null);
      return [field, { reviewedCases: values.length, mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null }];
    })),
    rows,
  };
}
