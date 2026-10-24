import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cases } from './cases.mjs';
import { scoreRun } from './scoring.mjs';
const run = () => ({ runId: 'scorer-self-test', condition: 'A', mode: 'fixture', model: 'fixture', modelSettings: 'none', promptVersion: 'test', appVersion: 'test', responses: cases.map(c => ({ caseId: c.id, answer: 'Scorer test fixture, not a model answer.', facts: { ...c.expected } })) });
test('scorer self-test accepts exact fixtures without claiming human reviews', () => {
  const s = scoreRun(run());
  assert.equal(s.factAccuracy, 1);
  assert.equal(s.humanReview.unsupportedClaims.mean, null);
});
test('omitted cases remain in denominator', () => {
  const r = run(); r.responses = [];
  const s = scoreRun(r);
  assert.equal(s.factAccuracy, 0); assert.equal(s.answeredCases, 0);
});
test('missing is not null and zero is not unavailable', () => {
  const r = run();
  delete r.responses[2].facts.monthsToPayoff;
  r.responses[4].facts.monthsToPayoff = null;
  assert.equal(scoreRun(r).factChecksPassed, scoreRun(run()).factChecksPassed - 2);
});
test('blank answers cannot pass with populated facts', () => {
  const r = run(); r.responses.forEach(x => { x.answer = ''; });
  assert.equal(scoreRun(r).factAccuracy, 0);
});
test('rejects duplicates, unknown cases, and unaudited reviews', () => {
  const r = run(); r.responses.push(r.responses[0]); assert.throws(() => scoreRun(r), /duplicate/);
  const s = run(); s.responses[0].caseId = 'unknown'; assert.throws(() => scoreRun(s), /Unknown/);
  const t = run(); t.responses[0].review = { understanding: 2 }; assert.throws(() => scoreRun(t), /reviewer/);
});
