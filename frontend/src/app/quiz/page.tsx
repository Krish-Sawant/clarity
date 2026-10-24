import type { Metadata } from "next";
import FixturePage from "@/components/FixturePage";
import { QuizTab } from "@/components/TestBench";

export const metadata: Metadata = { title: "Quiz" };

export default function QuizPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Quiz</h1>
      <FixturePage render={(fixtures) => <QuizTab fixtures={fixtures} />} />
    </div>
  );
}
