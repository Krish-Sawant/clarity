import { baselineQuestions, checkpointQuestions, lessons } from "../data/content";
import { CORE_DOMAINS, type AssessmentScore, type CoreDomain, type DomainScore, type Lesson, type Question } from "./types";

export type Answers = Record<string, string | null>;
const emptyScore = (): DomainScore => ({ correct: 0, total: 0, answered: 0 });

/** Demo-only grading. Habits never enter this function or its denominator. */
export function scoreAssessment(questions: Question[], answers: Answers): AssessmentScore {
  const byDomain = Object.fromEntries(CORE_DOMAINS.map((domain) => [domain, emptyScore()])) as Record<CoreDomain, DomainScore>;
  const score: AssessmentScore = { ...emptyScore(), skipped: 0, byDomain, byConcept: {} };
  for (const question of questions) {
    const selected = answers[question.id];
    const answered = question.options.some((option) => option.id === selected);
    const correct = answered && selected === question.correct_option_id;
    const concept = score.byConcept[question.concept_id] ??= emptyScore();
    for (const result of [score, byDomain[question.domain], concept]) {
      result.total += 1;
      if (answered) result.answered += 1;
      if (correct) result.correct += 1;
    }
    if (!answered) score.skipped += 1;
  }
  return score;
}

/** Missing/incorrect answers prioritize their topic. A stated goal breaks ties. */
export function getRecommendedLessons(answers: Answers, goal: "buffer" | "debt" | "budget"): Lesson[] {
  const score = scoreAssessment(baselineQuestions, answers);
  const goalDomain: CoreDomain = goal === "buffer" ? "saving" : goal === "debt" ? "credit" : "budget";
  const priority = (lesson: Lesson) => {
    if (lesson.domain === "advanced") return -100;
    const domain = score.byDomain[lesson.domain];
    return (domain.total - domain.correct) * 10 + (lesson.domain === goalDomain ? 1 : 0);
  };
  return [...lessons].sort((a, b) => priority(b) - priority(a));
}

export type MatchedComparison = {
  matchedConcepts: number;
  baseline: AssessmentScore;
  checkpoint: AssessmentScore;
  change: number;
  byConcept: { conceptId: string; baseline: DomainScore; checkpoint: DomainScore; change: number }[];
};

/** Compare only verified one-to-one links, never unrelated question totals. */
export function matchedComparison(baselineAnswers: Answers, checkpointAnswers: Answers): MatchedComparison {
  const matched = checkpointQuestions.filter((checkpoint) => baselineQuestions.some((baseline) =>
    checkpoint.pairs_with === baseline.id && checkpoint.concept_id === baseline.concept_id &&
    checkpoint.difficulty === baseline.difficulty && checkpoint.points === baseline.points));
  const ids = new Set(matched.map((question) => question.pairs_with));
  const baseline = scoreAssessment(baselineQuestions.filter((question) => ids.has(question.id)), baselineAnswers);
  const checkpoint = scoreAssessment(matched, checkpointAnswers);
  const byConcept = Object.keys(baseline.byConcept).map((conceptId) => ({
    conceptId, baseline: baseline.byConcept[conceptId], checkpoint: checkpoint.byConcept[conceptId],
    change: checkpoint.byConcept[conceptId].correct - baseline.byConcept[conceptId].correct,
  }));
  return { matchedConcepts: byConcept.length, baseline, checkpoint, change: checkpoint.correct - baseline.correct, byConcept };
}
