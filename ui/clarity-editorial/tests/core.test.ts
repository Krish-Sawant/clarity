import test from "node:test";
import assert from "node:assert/strict";
import { baselineQuestions, checkpointQuestions, lessons, sources } from "../src/data/content";
import { getRecommendedLessons, matchedComparison, scoreAssessment } from "../src/lib/assessment";
import { debtPayoff, simulatePaths } from "../src/lib/finance";
import { ApiError, requestJson, resolveApiUrl } from "../src/api/client";
import { backendService, futureAdvisorAdapter, futureDebtAdapter, IntegrationUnavailableError } from "../src/api/services";

const correctAnswers = (questions = baselineQuestions) => Object.fromEntries(questions.map((question) => [question.id, question.correct_option_id]));
const inputs = { income: 3600, rent: 1300, transportation: 300, spending: 1250, cash: 1500 };

test("published demo banks contain eight distinct, one-to-one matched concepts", () => {
  assert.equal(baselineQuestions.length, 8);
  assert.equal(checkpointQuestions.length, 8);
  assert.equal(new Set(baselineQuestions.map((q) => q.concept_id)).size, 8);
  for (const checkpoint of checkpointQuestions) {
    const baseline = baselineQuestions.find((q) => q.id === checkpoint.pairs_with);
    assert.ok(baseline);
    assert.notEqual(checkpoint.id, baseline.id);
    assert.notEqual(checkpoint.prompt, baseline.prompt);
    assert.notEqual(checkpoint.options.find((o) => o.id === checkpoint.correct_option_id)?.text, baseline.options.find((o) => o.id === baseline.correct_option_id)?.text);
    assert.equal(checkpoint.concept_id, baseline.concept_id);
    assert.equal(checkpoint.difficulty, baseline.difficulty);
    assert.equal(checkpoint.points, baseline.points);
  }
});

test("objective score exposes real counts and treats invalid or skipped answers as unanswered", () => {
  const answers: Record<string, string | null> = correctAnswers();
  answers[baselineQuestions[0].id] = null;
  answers[baselineQuestions[1].id] = "not-an-option";
  answers[baselineQuestions[2].id] = baselineQuestions[2].options.find((o) => o.id !== baselineQuestions[2].correct_option_id)!.id;
  const score = scoreAssessment(baselineQuestions, answers);
  assert.deepEqual({ correct: score.correct, total: score.total, answered: score.answered, skipped: score.skipped }, { correct: 5, total: 8, answered: 6, skipped: 2 });
  assert.equal(score.byDomain.budget.total, 2);
  assert.equal(score.byDomain.budget.answered, 0);
  assert.equal(score.byDomain.credit.correct, 1);
});

test("ungraded extra habit keys never change knowledge scores", () => {
  const knowledge = correctAnswers();
  assert.deepEqual(scoreAssessment(baselineQuestions, { ...knowledge, review_budget: "always", has_emergency_savings: "no" }), scoreAssessment(baselineQuestions, knowledge));
});

test("comparison reports eight matched concepts, improvement, unchanged scores, and regressions", () => {
  const allBaseline = correctAnswers();
  const allCheckpoint = correctAnswers(checkpointQuestions);
  assert.equal(matchedComparison(allBaseline, allCheckpoint).change, 0);
  assert.equal(matchedComparison({}, allCheckpoint).change, 8);
  assert.equal(matchedComparison(allBaseline, {}).change, -8);
  const comparison = matchedComparison(allBaseline, allCheckpoint);
  assert.equal(comparison.matchedConcepts, 8);
  assert.equal(comparison.baseline.total, 8);
  assert.equal(comparison.checkpoint.total, 8);
});

test("recommendations prioritize missed concepts then goal and keep advanced work last", () => {
  const answers = correctAnswers();
  for (const q of baselineQuestions.filter((q) => q.domain === "interest")) answers[q.id] = "wrong";
  const recommended = getRecommendedLessons(answers, "buffer");
  assert.equal(recommended[0].id, "apr-basics");
  assert.equal(recommended[1].id, "emergency-buffer");
  assert.equal(recommended.at(-1)?.id, "whatif-advanced");
  assert.equal(new Set(recommended.map((lesson) => lesson.id)).size, lessons.length);
});

test("all five lessons have attributable sources and usable exercise contracts", () => {
  assert.equal(lessons.length, 5);
  for (const lesson of lessons) {
    assert.ok(lesson.source_ids.length);
    assert.ok(lesson.source_ids.every((id) => sources.some((source) => source.source_id === id)));
    assert.ok(lesson.reflection.options.some((option) => option.id === lesson.reflection.correct_option_id));
    assert.ok(lesson.exercise.params);
  }
});

test("three cash paths conserve monthly cash and chart totals agree for each horizon", () => {
  for (const horizon of [6, 12, 24] as const) {
    const paths = simulatePaths(inputs, "none", horizon);
    assert.deepEqual(paths.map((p) => p.monthlySurplus), [750, 950, 1050]);
    for (const path of paths) {
      assert.equal(path.points.length, horizon + 1);
      assert.equal(path.points[0].cash, inputs.cash);
      assert.equal(path.finalCash, inputs.cash + horizon * path.monthlySurplus);
      assert.equal(path.points.at(-1)?.cash, path.finalCash);
    }
  }
});

test("shock costs occur exactly at month two or persist from month two as documented", () => {
  const base = simulatePaths(inputs, "none", 6)[0];
  const job = simulatePaths(inputs, "job-loss", 6)[0];
  const repair = simulatePaths(inputs, "repair", 6)[0];
  const rent = simulatePaths(inputs, "rent-rise", 6)[0];
  assert.equal(base.finalCash - job.finalCash, 3600);
  assert.equal(base.finalCash - repair.finalCash, 1500);
  assert.equal(base.finalCash - rent.finalCash, 150 * 5);
  assert.equal(job.points[1].cash, base.points[1].cash);
  assert.equal(job.points[2].cash, base.points[2].cash - 3600);
  assert.equal(job.minCash, Math.min(...job.points.map((p) => p.cash)));
});

test("discounted costs never become negative, deficits stay visible, and cents remain stable", () => {
  const low = simulatePaths({ income: 500, rent: 100, transportation: 0, spending: 50, cash: 0 }, "none", 6);
  assert.deepEqual(low.map((p) => p.monthlySurplus), [350, 400, 450]);
  const deficit = simulatePaths({ ...inputs, income: 0, cash: 0 }, "none", 6)[0];
  assert.ok(deficit.finalCash < 0);
  const decimal = simulatePaths({ income: 0.3, rent: 0.1, transportation: 0.1, spending: 0, cash: 0 }, "none", 24)[0];
  assert.equal(decimal.finalCash, 2.4);
});

test("invalid simulator inputs fail without a stale successful result", () => {
  for (const bad of [NaN, Infinity, -1, 10_000_001]) assert.throws(() => simulatePaths({ ...inputs, income: bad }, "none", 6), RangeError);
  assert.throws(() => simulatePaths(inputs, "none", 7 as never), RangeError);
});

test("local debt exercise handles zero, a capped final payment, interest, and insufficient payments", () => {
  assert.deepEqual(debtPayoff(0, 22, 0), { months: 0, interest: 0, payoff: true });
  assert.deepEqual(debtPayoff(1000, 0, 100), { months: 10, interest: 0, payoff: true });
  assert.deepEqual(debtPayoff(1000, 12, 2000), { months: 1, interest: 10, payoff: true });
  assert.deepEqual(debtPayoff(1500, 22, 20), { months: null, interest: 0, payoff: false });
  assert.throws(() => debtPayoff(1000, -1, 100), RangeError);
});

test("configured health URLs reject credentials, unsafe origins, and path escapes", () => {
  assert.equal(resolveApiUrl("http://localhost:8000", "/health").href, "http://localhost:8000/health");
  assert.equal(resolveApiUrl("https://example.test/api", "/status").href, "https://example.test/api/status");
  for (const base of ["http://example.test", "https://user:secret@example.test", "file:///tmp/file", "https://example.test?token=secret"]) assert.throws(() => resolveApiUrl(base, "/health"), ApiError);
  for (const path of ["//other.test/health", "/../secret", "/%2e%2e/secret", "/status?token=secret", "https://other.test"]) assert.throws(() => resolveApiUrl("https://example.test", path), ApiError);
});

test("health transport omits credentials and exposes actual HTTP failure messages", async () => {
  let seenOptions: RequestInit | undefined;
  const fetcher: typeof fetch = async (_url, options) => { seenOptions = options; return new Response(JSON.stringify({ status: "ok" }), { status: 200 }); };
  assert.deepEqual(await requestJson("https://example.test", "/health", { fetcher }), { status: "ok" });
  assert.equal(seenOptions?.credentials, "omit");
  assert.equal(seenOptions?.redirect, "error");
  await assert.rejects(requestJson("https://example.test", "/health", { fetcher: async () => new Response(JSON.stringify({ error: { message: "Authentication required." } }), { status: 401 }) }), (error: unknown) => error instanceof ApiError && error.status === 401 && error.message === "Authentication required.");
});

test("health transport reports timeout, offline, and malformed successful responses honestly", async () => {
  const delayed: typeof fetch = async (_url, options) => new Promise((_resolve, reject) => { options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }); });
  await assert.rejects(requestJson("https://example.test", "/health", { fetcher: delayed, timeoutMs: 5 }), (error: unknown) => error instanceof ApiError && error.code === "timeout");
  await assert.rejects(requestJson("https://example.test", "/health", { fetcher: async () => { throw new Error("offline"); } }), (error: unknown) => error instanceof ApiError && error.code === "network_error");
  await assert.rejects(requestJson("https://example.test", "/health", { fetcher: async () => new Response("<html />", { status: 200 }) }), (error: unknown) => error instanceof ApiError && error.code === "invalid_response");
});

test("unavailable live and branch features reject rather than substituting fixture success", async () => {
  assert.ok(Object.values(backendService.capabilities).every((available) => available === false));
  await assert.rejects(backendService.assessment.start("baseline"), IntegrationUnavailableError);
  await assert.rejects(backendService.tutor.explain("budget-surplus", "example"), IntegrationUnavailableError);
  await assert.rejects(backendService.actions.decide("synthetic", "approve"), IntegrationUnavailableError);
  await assert.rejects(futureAdvisorAdapter.getSignals(), IntegrationUnavailableError);
  await assert.rejects(futureDebtAdapter.calculate({ balanceCents: 1000, aprPercent: 20, monthlyPaymentCents: 100 }), IntegrationUnavailableError);
});
