import { notFound } from "next/navigation";
import { ClarityApp } from "../../components/clarity-app";
import type { Section } from "../../lib/types";

const sections = ["discover", "learn", "reassess", "future-lab", "advisor", "approach"];

export function generateStaticParams() { return sections.map((section) => ({ section })); }

export default async function ExperiencePage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <ClarityApp section={section as Section} />;
}
