export type PilotCondition = {
  id: "A" | "B"; label: string; runId: string; completedAt: string;
  answered: number; tasks: number; passed: number; checks: number;
  rate: number; incorrect: number; missing: number;
};
export type PilotRating = { mean: number | null; count: number };
export type RecordedPilot = {
  date: string; model: string; conditions: PilotCondition[];
  example: { caseId: string; expectedInterestCents: number; answers: { condition: string; answer: string }[] };
  review: {
    model: string; sameModelJudge: boolean; completedAt: string; pairs: number; totalPairs: number;
    excluded: { caseId: string; reason: string }[];
    criteria: { key: string; label: string; a: PilotRating; b: PilotRating }[];
    evidence: { caseId: string; reviews: { condition: string; improvement: string; ratings: { criterion: string; score: number | null; quote: string; rationale: string }[] }[] }[];
  };
};
