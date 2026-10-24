// Imported only by the server page. Publish a curated DTO, never raw transports.
import scoresA from "../../../../evaluation/runs/gemini-01/A.scores.json";
import scoresB from "../../../../evaluation/runs/gemini-01/B.scores.json";
import runA from "../../../../evaluation/runs/gemini-01/A.json";
import runB from "../../../../evaluation/runs/gemini-01/B.json";
import review from "../../../../evaluation/runs/review-01/review.json";
import type { PilotCondition, RecordedPilot } from "./evaluation-types";

type CheckedFact = { passed: boolean; actual?: unknown };

export function factBreakdown(checks: CheckedFact[]) {
  let missing = 0;
  let incorrect = 0;
  for (const check of checks) {
    if (check.passed) continue;
    if (Object.hasOwn(check, "actual")) incorrect++;
    else missing++;
  }
  return { missing, incorrect };
}

export function getRecordedPilot(): RecordedPilot {
  if (runA.model !== runB.model) throw new Error("The saved pilot conditions use different models; review the comparison.");
  const condition = (id: "A" | "B", label: string, scores: typeof scoresA | typeof scoresB, run: typeof runA | typeof runB): PilotCondition => ({
    id, label, runId: run.runId, completedAt: run.completedAt,
    answered: scores.answeredCases, tasks: scores.totalCases,
    passed: scores.factChecksPassed, checks: scores.factChecksTotal,
    rate: scores.factAccuracy, ...factBreakdown(scores.rows.flatMap((row) => row.checks)),
  });
  const caseId = "debt-interest";
  const expected = scoresA.rows.find((row) => row.caseId === caseId)?.checks.find((check) => check.field === "totalInterestCents")?.expected;
  if (typeof expected !== "number") throw new Error("The saved interest example is missing its checked value.");
  const criteria = [
    ["correctness", "Correctness"], ["clarity", "Clarity"], ["relevance", "Relevance"],
    ["causeAndEffect", "Cause and effect"], ["limitations", "Relevant limitations"], ["nextStepUsefulness", "Useful next step"],
  ] as const;
  return {
    date: new Date(runA.completedAt).toLocaleDateString("en-US", { timeZone: "America/New_York", year: "numeric", month: "long", day: "numeric" }),
    model: runA.model,
    conditions: [condition("A", "Text-only advisor", scoresA, runA), condition("B", "With calculation tools", scoresB, runB)],
    example: { caseId, expectedInterestCents: expected, answers: [runA, runB].map((run) => ({ condition: run.condition, answer: run.responses.find((response) => response.caseId === caseId)?.answer ?? "Saved answer unavailable." })) },
    review: {
      model: review.model, sameModelJudge: review.sameModelJudge, completedAt: review.completedAt,
      pairs: review.results.length, totalPairs: scoresA.totalCases,
      excluded: review.skipped.map(({ caseId: skippedCase, reason }) => ({ caseId: skippedCase, reason })),
      criteria: criteria.map(([key, label]) => ({ key, label, a: { mean: review.summary.A[key].meanOutOf2, count: review.summary.A[key].reviewed }, b: { mean: review.summary.B[key].meanOutOf2, count: review.summary.B[key].reviewed } })),
      evidence: review.results.map((result) => ({ caseId: result.caseId, reviews: result.reviews.map((item) => ({ condition: item.condition, improvement: item.improvement, ratings: item.ratings.map(({ criterion, score, quote, rationale }) => ({ criterion, score, quote, rationale })) })) })),
    },
  };
}
