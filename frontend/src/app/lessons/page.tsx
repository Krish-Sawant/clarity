import type { Metadata } from "next";
import FixturePage from "@/components/FixturePage";
import { LessonsTab } from "@/components/TestBench";

export const metadata: Metadata = { title: "Lessons" };

export default function LessonsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Lessons</h1>
      <FixturePage render={(fixtures) => <LessonsTab lessons={fixtures.lessons} sources={fixtures.sources} />} />
    </div>
  );
}
