export type Section = "overview" | "discover" | "learn" | "reassess" | "future-lab" | "advisor" | "approach" | "decisions" | "calculators" | "purchase-impact" | "loan-comfort" | "card-readiness" | "stress-test" | "plan-checkins" | "evidence";
export type CoreDomain = "budget" | "credit" | "saving" | "interest";
export type Domain = CoreDomain | "advanced";
export type AssessmentStage = "baseline" | "checkpoint";
export type Option = { id: string; text: string };
export type Question = {
  id: string; version: string; domain: CoreDomain; concept_id: string;
  difficulty: number; points: number; pairs_with?: string; prompt: string;
  options: Option[]; correct_option_id: string; explanation: string; source_ids: string[];
};
export type Lesson = {
  id: string; version: string; domain: Domain; concept_ids: string[];
  title: string; minutes: number; hook: string;
  concept: { term: string; definition: string; source_id: string };
  facts: { id: string; text: string; source_id: string }[];
  worked_example: { title: string; steps: { label: string; expression: string; value: number; unit?: string }[]; assumptions: string[] };
  exercise: { type: string; prompt: string; params: Record<string, number | number[] | undefined> };
  reflection: { prompt: string; options: Option[]; correct_option_id: string; explanation: string };
  source_ids: string[]; offline_tutor: { another_way: string; example: string };
};
export type Source = { source_id: string; title: string; publisher: string; url: string; domain: string; concept_ids: string[] };
export type QuizState = { answers: Record<string, string | null>; index: number; completed: boolean };
export type DomainScore = { correct: number; total: number; answered: number };
export type AssessmentScore = DomainScore & { skipped: number; byDomain: Record<CoreDomain, DomainScore>; byConcept: Record<string, DomainScore> };
export type SimulationInputs = { income: number; rent: number; transportation: number; spending: number; cash: number };
export type Shock = "none" | "job-loss" | "repair" | "rent-rise";
export type Horizon = 6 | 12 | 24;
export type DemoAction = {
  id: string; kind: "goal" | "reminder"; title: string; summary: string;
  amount: number; dueDate: string; status: "pending" | "approved" | "denied";
  createdAt: string; decidedAt?: string;
};
export type ActivityEvent = { id: string; title: string; detail: string; at: string };
export type DemoState = {
  version: 1; baseline: QuizState; checkpoint: QuizState;
  habits: Record<string, string>; habitsDone: boolean; goal: "buffer" | "debt" | "budget";
  completedLessons: string[]; lessonExercises: Record<string, number>; lessonReflections: Record<string, string>;
  simulation: SimulationInputs; shock: Shock; horizon: Horizon;
  actions: DemoAction[]; activity: ActivityEvent[]; sampleJourney: boolean;
};
export type DemoUpdate = (previous: DemoState) => DemoState;
export const DOMAIN_LABELS: Record<Domain, string> = {
  budget: "Cash flow", credit: "Credit", saving: "Saving", interest: "Interest", advanced: "Resilience",
};
export const CORE_DOMAINS: CoreDomain[] = ["budget", "credit", "saving", "interest"];
