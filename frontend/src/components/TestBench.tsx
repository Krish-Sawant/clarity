"use client";

import { useState } from "react";
import type { Fixtures, Lesson, MathCheck, Question, Source } from "@/lib/fixtures";

type Tab = "quiz" | "lessons" | "checks";

export default function TestBench({ fixtures }: { fixtures: Fixtures }) {
  const [tab, setTab] = useState<Tab>("quiz");
  const tabs: [Tab, string][] = [
    ["quiz", "Quiz"],
    ["lessons", `Lessons (${fixtures.lessons.length})`],
    ["checks", "Fixture checks"],
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Clarity test bench</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Dev-only page. Reads fixtures from <code>BackEnd/api/app/fixtures</code>; nothing is saved.
      </p>
      <nav className="mt-6 flex gap-2 border-b border-zinc-300 dark:border-zinc-700">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === id ? "border-blue-600 font-medium" : "border-transparent text-zinc-500"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="mt-6">
        {tab === "quiz" && <QuizTab fixtures={fixtures} />}
        {tab === "lessons" && <LessonsTab lessons={fixtures.lessons} sources={fixtures.sources} />}
        {tab === "checks" && <ChecksTab fixtures={fixtures} />}
      </div>
    </div>
  );
}

/* ---------- Quiz ---------- */

export function QuizTab({ fixtures }: { fixtures: Fixtures }) {
  const [stage, setStage] = useState<"baseline" | "checkpoint">("baseline");
  const questions = fixtures[stage];
  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["baseline", "checkpoint"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStage(s)}
            className={`rounded px-3 py-1 text-sm capitalize ${
              stage === s ? "bg-blue-600 text-white" : "bg-zinc-200 dark:bg-zinc-800"
            }`}
          >
            {s} ({fixtures[s].length})
          </button>
        ))}
      </div>
      {/* key resets answers when switching stage */}
      <Quiz key={stage} questions={questions} />
    </div>
  );
}

function Quiz({ questions }: { questions: Question[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const total = questions.reduce((n, q) => n + q.points, 0);
  const earned = questions.reduce((n, q) => n + (answers[q.id] === q.correct_option_id ? q.points : 0), 0);

  return (
    <div className="space-y-6">
      {questions.map((q, i) => {
        const picked = answers[q.id];
        return (
          <div key={q.id} className="rounded border border-zinc-300 p-4 dark:border-zinc-700">
            <div className="mb-1 text-xs text-zinc-500">
              #{i + 1} · {q.domain} · {q.kind} · {q.concept_id} · {q.points} pt
            </div>
            <p className="mb-3">{q.prompt}</p>
            <div className="space-y-1">
              {q.options.map((o) => {
                let tone = "";
                if (submitted && o.id === q.correct_option_id) tone = "bg-green-100 dark:bg-green-900/40";
                else if (submitted && o.id === picked) tone = "bg-red-100 dark:bg-red-900/40";
                return (
                  <label key={o.id} className={`flex cursor-pointer gap-2 rounded px-2 py-1 ${tone}`}>
                    <input
                      type="radio"
                      name={q.id}
                      checked={picked === o.id}
                      disabled={submitted}
                      onChange={() => setAnswers({ ...answers, [q.id]: o.id })}
                    />
                    {o.text}
                  </label>
                );
              })}
            </div>
            {submitted && (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                {picked === q.correct_option_id ? "✅ Correct. " : picked ? "❌ Wrong. " : "⚪ Skipped. "}
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}
      <div className="flex items-center gap-4">
        {submitted ? (
          <>
            <span className="font-medium">
              Score: {earned} / {total}
            </span>
            <button
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
              }}
              className="rounded bg-zinc-200 px-4 py-2 dark:bg-zinc-800"
            >
              Retake
            </button>
          </>
        ) : (
          <button onClick={() => setSubmitted(true)} className="rounded bg-blue-600 px-4 py-2 text-white">
            Submit ({Object.keys(answers).length}/{questions.length} answered)
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Lessons ---------- */

export function LessonsTab({ lessons, sources }: { lessons: Lesson[]; sources: Source[] }) {
  const [openId, setOpenId] = useState(lessons[0]?.id);
  const lesson = lessons.find((l) => l.id === openId);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {lessons.map((l) => (
          <button
            key={l.id}
            onClick={() => setOpenId(l.id)}
            className={`rounded px-3 py-1 text-sm ${
              openId === l.id ? "bg-blue-600 text-white" : "bg-zinc-200 dark:bg-zinc-800"
            }`}
          >
            {l.title}
          </button>
        ))}
      </div>
      {lesson && <LessonView key={lesson.id} lesson={lesson} sources={sources} />}
    </div>
  );
}

function LessonView({ lesson, sources }: { lesson: Lesson; sources: Source[] }) {
  const [picked, setPicked] = useState<string>();
  const sourceById = new Map(sources.map((s) => [s.source_id, s]));
  const { worked_example: ex, reflection } = lesson;

  return (
    <div className="space-y-5">
      <div className="text-xs text-zinc-500">
        {lesson.domain} · {lesson.minutes} min · exercise: {lesson.exercise.type}
      </div>
      <p className="text-lg">{lesson.hook}</p>
      <div className="rounded bg-zinc-100 p-3 dark:bg-zinc-900">
        <strong>{lesson.concept.term}:</strong> {lesson.concept.definition}
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {lesson.facts.map((f) => (
          <li key={f.id}>{f.text}</li>
        ))}
      </ul>
      <div>
        <h3 className="mb-2 font-medium">{ex.title}</h3>
        <table className="w-full text-sm">
          <tbody>
            {ex.steps.map((s, i) => (
              <tr key={i} className="border-b border-zinc-200 dark:border-zinc-800">
                <td className="py-1">{s.label}</td>
                <td className="py-1 text-zinc-500">{s.expression}</td>
                <td className="py-1 text-right font-mono">{s.value.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-zinc-500">{ex.assumptions.join(" ")}</p>
      </div>
      <div className="rounded border border-zinc-300 p-4 dark:border-zinc-700">
        <p className="mb-2 font-medium">Reflection: {reflection.prompt}</p>
        {reflection.options.map((o) => (
          <label key={o.id} className="flex cursor-pointer gap-2 py-0.5">
            <input type="radio" name="reflection" checked={picked === o.id} onChange={() => setPicked(o.id)} />
            {o.text}
          </label>
        ))}
        {picked && (
          <p className="mt-2 text-sm">
            {picked === reflection.correct_option_id ? "✅ Correct. " : "❌ Not quite. "}
            {reflection.explanation}
          </p>
        )}
      </div>
      <div className="text-sm">
        <span className="font-medium">Sources: </span>
        {lesson.source_ids.map((id, i) => {
          const s = sourceById.get(id);
          return (
            <span key={id}>
              {i > 0 && " · "}
              {s ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  {s.title}
                </a>
              ) : (
                <span className="text-red-600">{id} (missing)</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Fixture checks ---------- */

function computeMath({ op, args }: MathCheck): number | null {
  const [a, b, c] = args;
  switch (op) {
    case "subtract":
      return a - b;
    case "percent":
      return (a / b) * 100;
    case "ceil_divide":
      return Math.ceil(a / b);
    case "monthly_interest":
      return (a * b) / 100 / 12;
    case "compound":
      return a * (1 + b / 100) ** c;
    default:
      return null;
  }
}

const near = (x: number, y: number) => Math.abs(x - y) < 0.01;

type Check = { name: string; ok: boolean; detail: string };

function runChecks({ baseline, checkpoint, lessons, sources }: Fixtures): Check[] {
  const checks: Check[] = [];
  const sourceIds = new Set(sources.map((s) => s.source_id));
  const baselineById = new Map(baseline.map((q) => [q.id, q]));

  for (const q of [...baseline, ...checkpoint]) {
    const correct = q.options.find((o) => o.id === q.correct_option_id);
    checks.push({
      name: `${q.id}: correct option exists`,
      ok: !!correct,
      detail: correct ? correct.text : `no option "${q.correct_option_id}"`,
    });

    if (q.math_check) {
      const got = computeMath(q.math_check);
      const optionNum = correct ? Number(correct.text.replace(/[^0-9.]/g, "")) : NaN;
      const ok = got !== null && near(got, q.math_check.expected) && near(optionNum, q.math_check.expected);
      checks.push({
        name: `${q.id}: math (${q.math_check.op})`,
        ok,
        detail: `computed ${got === null ? "unknown op" : +got.toFixed(2)}, expected ${q.math_check.expected}, answer text "${correct?.text}"`,
      });
    }

    const missing = q.source_ids.filter((id) => !sourceIds.has(id));
    checks.push({
      name: `${q.id}: sources resolve`,
      ok: missing.length === 0,
      detail: missing.length ? `missing ${missing.join(", ")}` : q.source_ids.join(", "),
    });
  }

  for (const q of checkpoint) {
    const b = q.pairs_with ? baselineById.get(q.pairs_with) : undefined;
    const ok =
      !!b && b.concept_id === q.concept_id && b.difficulty === q.difficulty && b.points === q.points && b.prompt !== q.prompt;
    checks.push({
      name: `${q.id}: pairs with baseline`,
      ok,
      detail: b ? `${b.id} (concept ${b.concept_id})` : `no baseline "${q.pairs_with}"`,
    });
  }

  for (const l of lessons) {
    const missing = l.source_ids.filter((id) => !sourceIds.has(id));
    checks.push({
      name: `lesson ${l.id}: sources resolve`,
      ok: missing.length === 0,
      detail: missing.length ? `missing ${missing.join(", ")}` : `${l.source_ids.length} sources`,
    });
    const hasAnswer = l.reflection.options.some((o) => o.id === l.reflection.correct_option_id);
    checks.push({ name: `lesson ${l.id}: reflection answer exists`, ok: hasAnswer, detail: l.reflection.correct_option_id });
  }

  return checks;
}

function ChecksTab({ fixtures }: { fixtures: Fixtures }) {
  const checks = runChecks(fixtures);
  const failed = checks.filter((c) => !c.ok).length;
  return (
    <div>
      <p className={`mb-4 font-medium ${failed ? "text-red-600" : "text-green-600"}`}>
        {failed ? `${failed} of ${checks.length} checks failed` : `All ${checks.length} checks passed`}
      </p>
      <table className="w-full text-sm">
        <tbody>
          {checks.map((c) => (
            <tr key={c.name} className="border-b border-zinc-200 align-top dark:border-zinc-800">
              <td className="py-1 pr-2">{c.ok ? "✅" : "❌"}</td>
              <td className="py-1 pr-4 font-mono text-xs">{c.name}</td>
              <td className="py-1 text-zinc-500">{c.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
