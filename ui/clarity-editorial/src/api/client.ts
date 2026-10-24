export class ApiError extends Error {
  constructor(message: string, public code: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

/** Configured origins only; never accept credentials or an insecure remote host. */
export function resolveApiUrl(baseUrl: string, path: string): URL {
  let base: URL;
  try { base = new URL(baseUrl); } catch { throw new ApiError("The configured API base URL is invalid.", "invalid_api_url"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if ((base.protocol !== "https:" && !(base.protocol === "http:" && local)) || base.username || base.password || base.search || base.hash) {
    throw new ApiError("Use HTTPS for the API, or HTTP on localhost, with no embedded credentials, query, or fragment.", "unsafe_api_url");
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes("?") || path.includes("#") || /%2f|%5c|%2e/i.test(path) || path.split("/").some((part) => part === ".." || part === ".")) {
    throw new ApiError("The confirmed API path must start with a single slash and contain no query, fragment, or traversal.", "invalid_api_path");
  }
  const url = new URL(base.toString());
  url.pathname = `${base.pathname.replace(/\/$/, "")}${path}`;
  return url;
}

type RequestOptions = { timeoutMs?: number; signal?: AbortSignal; fetcher?: typeof fetch };

/** Public GET transport. Authenticated requests need a reviewed session adapter. */
export async function requestJson(baseUrl: string, path: string, options: RequestOptions = {}): Promise<unknown> {
  const url = resolveApiUrl(baseUrl, path);
  const timeoutMs = options.timeoutMs ?? 8_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new ApiError("API timeout must be positive.", "invalid_timeout");
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) controller.abort();
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      method: "GET", credentials: "omit", cache: "no-store", redirect: "error",
      headers: { Accept: "application/json" }, signal: controller.signal,
    });
    let payload: unknown;
    try { payload = await response.json(); } catch (error) {
      if (controller.signal.aborted) throw error;
      if (!response.ok) throw new ApiError(`The backend returned HTTP ${response.status}.`, "http_error", response.status);
      throw new ApiError("The backend returned an unreadable response; expected JSON.", "invalid_response", response.status);
    }
    if (!response.ok) {
      const error = payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
      const message = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message.slice(0, 300) : `The backend returned HTTP ${response.status}.`;
      throw new ApiError(message, "http_error", response.status);
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new ApiError("The backend health response must be a JSON object.", "invalid_response", response.status);
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) throw new ApiError("The backend took too long to respond. Check the server and retry.", "timeout");
    if (controller.signal.aborted) throw new ApiError("The connection check was cancelled.", "cancelled");
    throw new ApiError("Could not reach the backend. Check the URL, server, and allowed browser origin.", "network_error");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}
