import { NextResponse } from "next/server";
import { auth0 } from "../../../lib/auth/server";
import { resolveApiUrl } from "../../../api/client";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  const session = await auth0?.getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401, headers });
  if (!process.env.API_BASE_URL) return NextResponse.json({ error: "Backend connection is not configured." }, { status: 503, headers });
  try {
    const { token } = await auth0!.getAccessToken();
    const response = await fetch(resolveApiUrl(process.env.API_BASE_URL, "/api/me"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const message = response.status === 404
        ? "The connected server is missing Clarity's account endpoint. Check the backend address."
        : response.status === 401
          ? "The backend rejected your Auth0 token. Check its Auth0 domain and API audience, then sign in again."
          : "The backend could not complete the account check. Please try again.";
      return NextResponse.json({ error: message }, { status: response.status === 401 ? 401 : 502, headers });
    }
    return NextResponse.json(await response.json(), { headers });
  } catch {
    return NextResponse.json({ error: "Could not verify your backend connection. Try signing in again." }, { status: 502, headers });
  }
}
