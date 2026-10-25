import "server-only";
import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { redirect } from "next/navigation";
import { authConfiguration } from "../../../../../authentication/config";

export const authConfig = authConfiguration(process.env);
export const auth0 = authConfig.configured ? new Auth0Client(authConfig.options) : null;

export async function requireSession() {
  const session = await auth0?.getSession();
  if (!session) redirect("/login");
  return session;
}
