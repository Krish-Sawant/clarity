import Link from "next/link";
import { requireSession } from "../../lib/auth/server";
import { AccountCheck } from "../../components/account-check";

export default async function AccountPage() {
  const session = await requireSession();
  return <main className="auth-page"><section className="auth-card">
    <p className="eyebrow">CLARITY / ACCOUNT</p>
    <h1>Welcome, {session.user.name ?? "learner"}.</h1>
    <p>You are signed in with Auth0.</p>
    <AccountCheck />
    <Link href="/">Return to Clarity ↗</Link>
  </section></main>;
}
