import type { AssessmentStage, Horizon, Shock, SimulationInputs } from "../lib/types";

/** These are UI adapter contracts, NOT claims that HTTP routes currently exist. */
export type BackendCapabilities = {
  assessment: boolean; learning: boolean; tutor: boolean; progress: boolean;
  simulation: boolean; actions: boolean; authenticatedSession: boolean;
};
export type PublicQuestion = {
  id: string; version: string; concept_id: string; prompt: string;
  options: { id: string; text: string }[];
};
export type LiveAssessmentSession = { sessionId: string; stage: AssessmentStage; questions: PublicQuestion[] };
export type OfficialScore = { correct: number; total: number; answered: number; finalizedAt: string };
export type LiveProposal = { id: string; title: string; summary: string; kind: "goal" | "reminder"; status: string };
export interface ClarityBackend {
  readonly capabilities: BackendCapabilities;
  checkHealth(): Promise<unknown>;
  assessment: {
    start(stage: AssessmentStage): Promise<LiveAssessmentSession>;
    answer(sessionId: string, questionId: string, optionId: string | null): Promise<void>;
    finalize(sessionId: string): Promise<OfficialScore>;
  };
  learning: { getPlan(): Promise<unknown>; completeLesson(lessonId: string, exercise: unknown): Promise<void> };
  tutor: { explain(lessonId: string, intent: "another_way" | "example"): Promise<string> };
  progress: { get(): Promise<unknown> };
  simulation: { run(inputs: SimulationInputs, shock: Shock, horizon: Horizon): Promise<unknown> };
  actions: { propose(kind: "goal" | "reminder", payload: unknown): Promise<LiveProposal>; decide(id: string, decision: "approve" | "deny"): Promise<unknown> };
}

export type AdvisorSignal = {
  id: string; kind: "new-job" | "moving" | "overspending" | "student-loan" | "idle-cash";
  title: string; message: string; evidence: string; amount: number;
};
/** Branch review must verify date/category validation and authenticated ownership. */
export interface FutureAdvisorAdapter { getSignals(): Promise<AdvisorSignal[]> }
/** Branch-only finance.ts uses integer USD cents; the local demo uses USD. */
export interface FutureDebtAdapter {
  calculate(input: { balanceCents: number; aprPercent: number; monthlyPaymentCents: number; maxMonths?: number }): Promise<{
    status: "paid_off" | "payment_too_low" | "horizon_exceeded";
    monthsToPayoff: number | null; totalInterestCents: number; remainingCents: number;
  }>;
}
