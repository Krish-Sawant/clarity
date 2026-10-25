/* eslint-disable @next/next/no-html-link-for-pages -- Auth0 endpoints require full document navigation. */
import { redirect } from "next/navigation";
import { auth0 } from "../../lib/auth/server";

export default async function LoginPage() {
  if (await auth0?.getSession()) redirect("/");
  return <main className="auth-page"><section className="auth-card">
    <p className="eyebrow">CLARITY / YOUR NEXT CHAPTER</p>
    <h1>A clearer future starts here.</h1>
    <p>Sign in to explore your financial learning journey.</p>
    {auth0 ? <>
      <a className="header-cta" href="/auth/login">Log in with Auth0 ↗</a>
      <p>New here? <a href="/auth/login?screen_hint=signup">Create an account</a></p>
    </> : <p role="status">Login setup is required. Configure the server environment using authentication/README.md, then restart Clarity.</p>}
    <small>Authentication is powered by Auth0.</small>
  </section></main>;
}
