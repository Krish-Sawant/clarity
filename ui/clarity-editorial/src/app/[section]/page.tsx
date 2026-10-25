import { notFound, redirect } from "next/navigation";
import { ClarityApp } from "../../components/clarity-app";
import type { Section } from "../../lib/types";
import { requireSession } from "../../lib/auth/server";

const sections = ["discover", "learn", "future-lab", "advisor", "approach", "decisions", "calculators", "before-you-commit"];

// Pages that were folded into another page keep working as links.
const merged: Record<string, string> = {
  reassess: "/discover?tab=reassess",
  "stress-test": "/future-lab#stress-test",
  "plan-checkins": "/calculators#plan-checkins",
  "purchase-impact": "/before-you-commit",
  "loan-comfort": "/before-you-commit?tab=loan",
  "card-readiness": "/before-you-commit?tab=card",
  evidence: "/approach#evidence",
};

export default async function ExperiencePage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  await requireSession();
  const { section } = await params;
  if (merged[section]) redirect(merged[section]);
  if (!sections.includes(section)) notFound();
  const { tab } = await searchParams;
  if (section === "approach") {
    const { getRecordedPilot } = await import("../../lib/evaluation");
    return <ClarityApp section="approach" evidence={getRecordedPilot()} />;
  }
  return <ClarityApp section={section as Section} tab={typeof tab === "string" ? tab : undefined} />;
}
