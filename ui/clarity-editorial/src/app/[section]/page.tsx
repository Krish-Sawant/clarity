import { notFound } from "next/navigation";
import { ClarityApp } from "../../components/clarity-app";
import type { Section } from "../../lib/types";
import { requireSession } from "../../lib/auth/server";

const sections = ["discover", "learn", "reassess", "future-lab", "advisor", "approach", "decisions", "calculators", "purchase-impact", "evidence"];

export default async function ExperiencePage({ params }: { params: Promise<{ section: string }> }) {
  await requireSession();
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  if (section === "evidence") {
    const { getRecordedPilot } = await import("../../lib/evaluation");
    return <ClarityApp section="evidence" evidence={getRecordedPilot()} />;
  }
  return <ClarityApp section={section as Section} />;
}
