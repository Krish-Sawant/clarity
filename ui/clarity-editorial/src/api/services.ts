import { ApiError, requestJson, resolveApiUrl } from "./client";
import type { AdvisorAdapter, ClarityBackend, DebtEngineAdapter } from "./contracts";
import { createAdvisorPlan, getAdvisorSignals } from "./advisor";
import { calculateDebt } from "../../../../finance";

export class IntegrationUnavailableError extends ApiError {
  constructor(feature: string) {
    super(`${feature} is not connected: this checkout has no verified HTTP route or authenticated session for it. Continue in the labeled local demo.`, "integration_unavailable");
  }
}

export function getConnectionConfig(): { baseUrl: string; healthPath: string } | null {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const healthPath = process.env.NEXT_PUBLIC_API_HEALTH_PATH?.trim();
  if (!baseUrl && !healthPath) return null;
  if (!baseUrl || !healthPath) throw new ApiError("Configure both NEXT_PUBLIC_API_BASE_URL and a teammate-confirmed NEXT_PUBLIC_API_HEALTH_PATH.", "incomplete_config");
  resolveApiUrl(baseUrl, healthPath);
  return { baseUrl, healthPath };
}

export async function checkBackendConnection(): Promise<unknown> {
  const config = getConnectionConfig();
  if (!config) throw new ApiError("No backend health URL is configured. This checkout does not contain a health route; add only a teammate-confirmed URL and path.", "not_configured");
  return requestJson(config.baseUrl, config.healthPath);
}

const unavailable = async (feature: string): Promise<never> => { throw new IntegrationUnavailableError(feature); };

/** No fabricated route mappings and no silent fixture fallback. */
export const backendService: ClarityBackend = {
  capabilities: { assessment: false, learning: false, tutor: false, progress: false, simulation: false, actions: false, authenticatedSession: false },
  checkHealth: checkBackendConnection,
  assessment: {
    start: async () => unavailable("Live assessment"),
    answer: async () => unavailable("Live assessment answers"),
    finalize: async () => unavailable("Official scoring"),
  },
  learning: { getPlan: async () => unavailable("Saved learning plan"), completeLesson: async () => unavailable("Saved lesson progress") },
  tutor: { explain: async () => unavailable("Gemini tutor") },
  progress: { get: async () => unavailable("Saved progress") },
  simulation: { run: async () => unavailable("Backend simulation") },
  actions: { propose: async () => unavailable("Authenticated action proposal"), decide: async () => unavailable("Authenticated action decision") },
};

export const branchIntegrationStatus = [
  { id: "deterministic-calculations", title: "Debt & savings engine", branch: "main", status: "available-local", href: "/calculators", detail: "The merged integer-cent engine calculates debt payoff, extra-payment comparisons, and savings goals with explicit incomplete-result states." },
  { id: "proactive-advisor", title: "Proactive advisor", branch: "main", status: "available-local", href: "/advisor", detail: "The merged detection and planning engine runs locally on validated synthetic activity. Bank connections, monitoring, delivery, and authenticated APIs are not connected." },
  { id: "future-decisions", title: "Future Decisions", branch: "main", status: "available-local", href: "/decisions", detail: "Five merged scenario models compare cash, debt, and net worth. A scripted local guide calls calculation tools; no live model is connected." },
  { id: "purchase-impact", title: "Purchase preview", branch: "main", status: "available-local", href: "/before-you-commit", detail: "The merged purchase detector and paired savings projections show the timing impact of a synthetic purchase after funding and balance assumptions are confirmed." },
] as const;

export const advisorAdapter: AdvisorAdapter = {
  getSignals: async () => getAdvisorSignals(),
  getPlan: async (kind, inputs) => createAdvisorPlan(kind, inputs),
};
export const debtAdapter: DebtEngineAdapter = { calculate: async (input) => calculateDebt(input) };
