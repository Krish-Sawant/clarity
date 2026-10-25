import { ClarityApp } from "../components/clarity-app";
import { requireSession } from "../lib/auth/server";

export default async function Home() {
  await requireSession();
  return <ClarityApp section="overview" />;
}
