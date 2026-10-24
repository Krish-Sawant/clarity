import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criteria, validateJudgment, summarizeReviews, parseJudgment } from './judge-core.mjs';
const candidates = [{ candidateId: 'candidate-1', answer: 'You pay less interest because the balance falls faster.' }];
const judgment = () => ({ reviews: [{ candidateId: 'candidate-1', ratings: criteria.map(criterion => ({ criterion, score: 2, quote: 'the balance falls faster', rationale: 'Explains the mechanism.' })), improvement: 'State the key assumption.' }] });
test('accepts exact evidence and all criteria', () => { validateJudgment(judgment(), candidates); });
test('rejects invented evidence, duplicate criteria and unknown candidates', () => {
  const a = judgment(); a.reviews[0].ratings[0].quote = 'invented'; assert.throws(() => validateJudgment(a, candidates), /quote/);
  const b = judgment(); b.reviews[0].ratings[1].criterion = 'correctness'; assert.throws(() => validateJudgment(b, candidates), /duplicate/);
  const c = judgment(); c.reviews[0].candidateId = 'wrong'; assert.throws(() => validateJudgment(c, candidates), /candidate/);
});
test('null ratings excluded with coverage; no review remains null', () => {
  const r = judgment().reviews[0]; r.condition = 'A'; r.ratings[0].score = null;
  const s = summarizeReviews({ results: [{ reviews: [r] }] });
  assert.equal(s.A.correctness.reviewed, 0); assert.equal(s.A.correctness.meanOutOf2, null);
  assert.equal(s.A.clarity.meanOutOf2, 2); assert.equal(s.B.clarity.meanOutOf2, null);
});
test('edge ellipsis keeps exact evidence and original quote for audit', () => {
  const j = judgment(); j.reviews[0].ratings[0].quote = 'the balance falls faster...';
  validateJudgment(j, candidates);
  assert.equal(j.reviews[0].ratings[0].quote, 'the balance falls faster');
  assert.equal(j.reviews[0].ratings[0].originalQuote, 'the balance falls faster...');
});
test('paraphrases, internal ellipses and trivial excerpts remain rejected', () => {
  for (const quote of ['the balance falls slower...', 'You pay...the balance falls faster', 'You...']) {
    const j = judgment(); j.reviews[0].ratings[0].quote = quote;
    assert.throws(() => validateJudgment(j, candidates), /quote/);
  }
});
test('invalid evidence is classified as an unscored review, not a transport failure', () => {
  const j = judgment(); j.reviews[0].ratings[0].quote = 'invented paraphrase';
  const response = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(j) }] }] };
  assert.throws(() => parseJudgment(response, candidates), error => error.code === 'INVALID_JUDGMENT');
  assert.throws(() => parseJudgment({ status: 'incomplete' }, candidates), error => error.code !== 'INVALID_JUDGMENT');
});
