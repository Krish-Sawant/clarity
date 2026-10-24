import { ApiError, requestJson, resolveApiUrl } from "./client";
import type { ClarityBackend, FutureAdvisorAdapter, FutureDebtAdapter } from "./contracts";

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
  { id: "deterministic-calculations", title: "Debt & savings engine", branch: "origin/deterministic-calculations", status: "waiting-on-branch", detail: "Pure TypeScript engine is unmerged. Its USD-cent contract and outcome states need review before adoption." },
  { id: "proactive-advisor", title: "Proactive advisor", branch: "origin/feature/proactive-advisor", status: "waiting-on-branch", detail: "Life-moment detection is unmerged. No bank connection, monitoring, delivery, or authenticated API is present." },
] as const;

export const futureAdvisorAdapter: FutureAdvisorAdapter = { getSignals: async () => unavailable("Proactive advisor") };
export const futureDebtAdapter: FutureDebtAdapter = { calculate: async () => unavailable("Branch debt engine") };
