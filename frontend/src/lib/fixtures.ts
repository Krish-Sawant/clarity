import { readFile } from "node:fs/promises";
import path from "node:path";

// The backend has no HTTP API yet, so the test bench reads its fixture JSON
// straight from disk. Turbopack can't import files outside frontend/.
const FIXTURES_DIR = path.resolve(process.cwd(), "..", "BackEnd", "api", "app", "fixtures");

export type Option = { id: string; text: string };

export type MathCheck = { op: string; args: number[]; expected: number };

export type Question = {
  id: string;
  version: string;
  domain: string;
  concept_id: string;
  difficulty: number;
  points: number;
  kind: string;
  prompt: string;
  options: Option[];
  correct_option_id: string;
  math_check?: MathCheck;
  explanation: string;
  source_ids: string[];
  pairs_with?: string;
};

export type Source = {
  source_id: string;
  title: string;
  publisher: string;
  url: string;
  domain: string;
};

export type Lesson = {
  id: string;
  title: string;
  domain: string;
  minutes: number;
  hook: string;
  concept: { term: string; definition: string; source_id: string };
  facts: { id: string; text: string; source_id: string }[];
  worked_example: {
    title: string;
    steps: { label: string; expression: string; value: number }[];
    assumptions: string[];
  };
  exercise: { type: string; prompt: string };
  reflection: { prompt: string; options: Option[]; correct_option_id: string; explanation: string };
  source_ids: string[];
};

export type Fixtures = {
  baseline: Question[];
  checkpoint: Question[];
  lessons: Lesson[];
  sources: Source[];
};

async function readJson(name: string) {
  return JSON.parse(await readFile(path.join(FIXTURES_DIR, name), "utf8"));
}

export async function loadFixtures(): Promise<Fixtures> {
  const [baseline, checkpoint, lessons, sources] = await Promise.all([
    readJson("baseline_questions.json"),
    readJson("checkpoint_questions.json"),
    readJson("lessons.json"),
    readJson("sources_fallback.json"),
  ]);
  return {
    baseline: baseline.questions,
    checkpoint: checkpoint.questions,
    lessons: lessons.lessons,
    sources: sources.sources,
  };
}
