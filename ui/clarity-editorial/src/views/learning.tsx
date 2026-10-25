"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { sources } from "../data/content";
import { getRecommendedLessons } from "../lib/assessment";
import { currency, debtPayoff } from "../lib/finance";
import { DOMAIN_LABELS, type Lesson } from "../lib/types";
import { useDemo } from "../state/demo-store";

function numberParam(lesson: Lesson, key: string, fallback: number) {
  const value = lesson.exercise.params[key];
  return typeof value === "number" ? value : fallback;
}

function LessonExercise({ lesson }: { lesson: Lesson }) {
  const { state, update } = useDemo();
  const type = lesson.exercise.type;
  const defaultValue = type === "budget_allocator" ? numberParam(lesson, "variable", 900) : type === "emergency_shock" ? numberParam(lesson, "monthly_saving", 150) : numberParam(lesson, "payment", 120);
  const min = type === "budget_allocator" ? numberParam(lesson, "variable_min", 300) : type === "emergency_shock" ? numberParam(lesson, "saving_min", 25) : numberParam(lesson, "payment_min", 30);
  const max = type === "budget_allocator" ? numberParam(lesson, "variable_max", 1500) : type === "emergency_shock" ? numberParam(lesson, "saving_max", 600) : numberParam(lesson, "payment_max", 400);
  const storedValue = state.lessonExercises[lesson.id] ?? defaultValue;
  const value = Math.max(min, Math.min(max, Number.isFinite(storedValue) ? storedValue : defaultValue));
  const label = type === "budget_allocator" ? "Monthly variable spending" : type === "emergency_shock" ? "Monthly saving" : "Monthly card payment";
  const income = numberParam(lesson, "income", 3600);
  const fixed = numberParam(lesson, "fixed", 1650);
  const other = numberParam(lesson, "other", 300);
  const balance = numberParam(lesson, "balance", 1500);
  const apr = numberParam(lesson, "apr_pct", 22);
  const payoff = debtPayoff(balance, apr, value);
  const shock = numberParam(lesson, "shock", 3000);
  const buffers = Array.isArray(lesson.exercise.params.buffers) ? lesson.exercise.params.buffers : [500, 1500, 4000];
  const lowerApr = numberParam(lesson, "apr_low", 18);
  const higherApr = numberParam(lesson, "apr_high", 29);
  const low = debtPayoff(balance, lowerApr, value);
  const high = debtPayoff(balance, higherApr, value);

  return <section className="exercise-panel" aria-labelledby={`exercise-${lesson.id}`}>
    <p className="eyebrow">Try the idea · deterministic local math</p>
    <h3 id={`exercise-${lesson.id}`}>Make the numbers move.</h3>
    <p>{lesson.exercise.prompt}</p>
    <div className="exercise-controls"><label className="field" htmlFor={`slider-${lesson.id}`}><span>{label} <strong>{currency(value)}</strong></span><input id={`slider-${lesson.id}`} type="range" min={min} max={max} step={type === "budget_allocator" ? 50 : type === "emergency_shock" ? 25 : 10} value={value} onChange={(event) => update((previous) => ({ ...previous, lessonExercises: { ...previous.lessonExercises, [lesson.id]: Number(event.target.value) } }))} /></label><div className="range-labels"><span>{currency(min)}</span><span>{currency(max)}</span></div></div>
    <div className="exercise-output" aria-live="polite">
      {type === "budget_allocator" && <><div className="exercise-metric"><span>Monthly surplus</span><strong>{currency(income - fixed - value - other)}</strong></div><p>{currency(income)} income − {currency(fixed)} fixed costs − {currency(value)} variable spending − {currency(other)} other bills.</p><p>{value <= 600 ? "✓ You freed up at least $300 compared with the original $900 variable spending." : "Try moving variable spending to $600 or below to free up another $300."}</p></>}
      {type === "min_payment_payoff" && <><div className="exercise-metrics"><div><span>Payoff time</span><strong>{payoff.payoff ? `${payoff.months} months` : "No payoff"}</strong></div><div><span>Total interest</span><strong>{currency(payoff.interest)}</strong></div></div><p>{payoff.payoff ? `On ${currency(balance)} at ${apr}% APR, with no new charges or fees.` : "This payment does not clear the balance within the model limit. Increase the payment."} Interest is rounded to cents monthly using APR ÷ 12; real card billing can differ.</p></>}
      {type === "emergency_shock" && <><div className="buffer-comparison">{buffers.map((buffer) => <div key={buffer}><span>{currency(buffer)} starting buffer</span><strong>{buffer >= shock ? "Covered now" : `${Math.ceil((shock - buffer) / value)} months`}</strong><small>to cover {currency(shock)}</small></div>)}</div><p>Months = round up ((target − starting buffer) ÷ monthly saving), with a minimum of zero. No interest, withdrawals, or borrowing included.</p></>}
      {type === "apr_compare" && <><div className="apr-comparison">{[{ apr: lowerApr, result: low }, { apr: higherApr, result: high }].map(({ apr: rate, result }) => <div key={rate}><span>{rate}% APR</span><strong>{result.payoff ? `${result.months} months` : "No payoff"}</strong><small>{currency(result.interest)} interest</small></div>)}</div><p>Same {currency(balance)} balance and {currency(value)} monthly payment. No new charges or fees; interest is rounded to cents monthly using APR ÷ 12. Actual card charges may differ.</p></>}
    </div>
  </section>;
}

function LocalTutor({ lesson }: { lesson: Lesson }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [response, setResponse] = useState("");
  const requestId = useRef(0);

  async function explain(kind: "another_way" | "example" | "error") {
    const id = ++requestId.current;
    setStatus("loading");
    setResponse("");
    await new Promise((resolve) => setTimeout(resolve, 550));
    if (id !== requestId.current) return;
    if (kind === "error") {
      setStatus("error");
      return;
    }
    setResponse(lesson.offline_tutor[kind]);
    setStatus("success");
  }

  return <section className="panel tutor-panel" aria-labelledby="tutor-heading">
    <div className="section-heading"><div><p className="eyebrow">A second perspective</p><h3 id="tutor-heading">Let’s make it click.</h3></div><span className="tag">Sample tutor · not Gemini</span></div>
    <p>Choose a prewritten explanation from the lesson fixture. Nothing is sent to an AI provider.</p>
    <div className="quiz-actions"><button className="button button--secondary" disabled={status === "loading"} onClick={() => explain("another_way")}>Explain another way</button><button className="button button--ghost" disabled={status === "loading"} onClick={() => explain("example")}>Show a sample example</button></div>
    <div className="tutor-response" role={status === "error" ? "alert" : "status"} aria-live="polite">
      {status === "idle" && <p>Your sample explanation will appear here.</p>}
      {status === "loading" && <p>Opening the local sample explanation…</p>}
      {status === "success" && <><span className="eyebrow">Prewritten local explanation</span><p>{response}</p></>}
      {status === "error" && <><p>The sample explanation could not be opened in this error preview. No live Gemini request was made.</p><button className="button button--secondary" onClick={() => explain("another_way")}>Retry sample explanation</button></>}
    </div>
    <details className="tutor-demo-controls"><summary>Preview an unavailable tutor</summary><p>See how the experience handles an explanation error.</p><button className="button button--ghost" disabled={status === "loading"} onClick={() => explain("error")}>Preview tutor error</button></details>
  </section>;
}

function LessonDetail({ lesson }: { lesson: Lesson }) {
  const { state, update } = useDemo();
  const [reflectionSubmitted, setReflectionSubmitted] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const reflectionAnswer = state.lessonReflections[lesson.id];
  const complete = state.completedLessons.includes(lesson.id);
  const reflectionCorrect = reflectionAnswer === lesson.reflection.correct_option_id;
  const lessonSources = sources.filter((source) => lesson.source_ids.includes(source.source_id));

  function completeLesson() {
    if (!reflectionAnswer || !reflectionCorrect) {
      setReflectionSubmitted(true);
      setCompletionError("Choose the answer that matches the concept before marking this lesson complete. The explanation can help.");
      return;
    }
    setCompletionError("");
    update((previous) => ({ ...previous, completedLessons: [...new Set([...previous.completedLessons, lesson.id])], activity: [{ id: crypto.randomUUID(), title: "Lesson completed", detail: `${lesson.title} · local demo reflection.`, at: new Date().toISOString() }, ...previous.activity] }));
  }

  return <article className="lesson-content">
    <div className="lesson-kicker"><span className="tag">{DOMAIN_LABELS[lesson.domain]}</span><span className="caption">{lesson.minutes} min · source-backed lesson fixture</span></div>
    <h2>{lesson.title}</h2><p className="lesson-hook">{lesson.hook}</p>
    <div className="lesson-definition"><p className="eyebrow">The idea</p><h3>{lesson.concept.term}</h3><p>{lesson.concept.definition}</p></div>

    <section className="worked-example" aria-labelledby="worked-example-heading"><p className="eyebrow">An example, in plain numbers</p><h3 id="worked-example-heading">{lesson.worked_example.title}</h3>{lesson.worked_example.steps.map((step, index) => <div className="example-row" key={`${step.label}-${index}`}><div><span>{step.label}</span><small>{step.expression}</small></div><strong>{step.unit === "%" ? `${step.value}%` : currency(step.value)}</strong></div>)}<p className="caption">{lesson.worked_example.assumptions.join(" ")}</p></section>

    <LessonExercise lesson={lesson} />

    <section className="reflection-panel" aria-labelledby="reflection-heading"><p className="eyebrow">One small check</p><h3 id="reflection-heading">{lesson.reflection.prompt}</h3><fieldset className="answer-list"><legend className="sr-only">Choose a reflection answer</legend>{lesson.reflection.options.map((option) => <label className={`answer-option ${reflectionAnswer === option.id ? "is-selected" : ""}`} key={option.id}><input type="radio" name={`reflection-${lesson.id}`} value={option.id} checked={reflectionAnswer === option.id} onChange={() => {
      setReflectionSubmitted(false);
      setCompletionError("");
      update((previous) => ({ ...previous, lessonReflections: { ...previous.lessonReflections, [lesson.id]: option.id } }));
    }} /><span className="option-letter" aria-hidden="true">{option.id.toUpperCase()}</span><span>{option.text}</span><span className="option-check" aria-hidden="true">{reflectionAnswer === option.id ? "✓" : ""}</span></label>)}</fieldset><button className="button button--secondary" disabled={!reflectionAnswer} onClick={() => setReflectionSubmitted(true)}>Check reflection</button>{reflectionSubmitted && <div className="inline-notice" role="status"><strong>{reflectionCorrect ? "✓ That’s the idea." : "× Let’s revisit this one."}</strong><p>{lesson.reflection.explanation}</p></div>}</section>

    <LocalTutor lesson={lesson} />

    <details className="source-list"><summary>Sources & assumptions ({lessonSources.length})</summary><p>This demo uses the repository’s curated lesson content. These references support the concepts; they are not personalized financial advice.</p><ul>{lessonSources.map((source) => <li key={source.source_id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} <span aria-hidden="true">↗</span></a><small>{source.publisher}</small></li>)}</ul></details>

    <footer className="lesson-footer">{completionError && <p className="inline-notice inline-notice--error" role="alert">{completionError}</p>}<div className="quiz-actions"><button className="button button--primary" disabled={complete} onClick={completeLesson}>{complete ? "✓ Lesson complete" : "Mark lesson complete"}</button><Link className="button button--ghost" href="/discover?tab=reassess">Check what stayed with you <span aria-hidden="true">↗</span></Link></div><p className="caption">Completing a lesson is a local demo progress record, separate from your assessment score.</p></footer>
  </article>;
}

export function LearningView() {
  const { state, update, hydrated } = useDemo();
  const [selectedId, setSelectedId] = useState("");
  const recommended = getRecommendedLessons(state.baseline.answers, state.goal);
  const selected = recommended.find((lesson) => lesson.id === selectedId) ?? recommended[0];
  const coreCount = recommended.filter((lesson) => lesson.domain !== "advanced").length;
  const coreComplete = recommended.filter((lesson) => lesson.domain !== "advanced" && state.completedLessons.includes(lesson.id)).length;

  if (!hydrated) return <div className="panel loading-state" role="status">Restoring your learning path…</div>;

  return <>
    <header className="view-header"><div><p className="eyebrow">02 / Learn</p><h1>Small lessons.<br />Lasting clarity.</h1></div><p>A few minutes, one useful idea, and numbers you can play with. Build confidence by understanding the why.</p></header>
    <section className="learning-intro"><div><span className="eyebrow">Your learning path</span><p>{state.baseline.completed ? "Ordered by concepts you missed or skipped, then your chosen goal. This is a local rule, not an AI recommendation." : "Start anywhere. Complete Discover for a path ordered by your missed concepts."}</p></div><label className="field"><span>What would you like to focus on?</span><select value={state.goal} onChange={(event) => update((previous) => ({ ...previous, goal: event.target.value as "buffer" | "debt" | "budget" }))}><option value="buffer">Build an emergency buffer</option><option value="debt">Understand borrowing</option><option value="budget">Find more breathing room</option></select></label><div className="learning-progress"><strong>{coreComplete}<small> / {coreCount}</small></strong><span>core lessons complete</span></div></section>
    {!state.baseline.completed && <div className="inline-notice">Your starting point is still open. <Link href="/discover">Take the eight-question check</Link> for a more useful lesson order, or explore the sample lessons below.</div>}
    <div className="learning-layout"><nav className="lesson-menu" aria-label="Learning modules">{recommended.map((lesson, index) => <button key={lesson.id} className={`lesson-tab ${selected.id === lesson.id ? "is-active" : ""} ${state.completedLessons.includes(lesson.id) ? "is-complete" : ""}`} aria-current={selected.id === lesson.id ? "true" : undefined} onClick={() => setSelectedId(lesson.id)}><span className="lesson-number">{String(index + 1).padStart(2, "0")}</span><span><small>{DOMAIN_LABELS[lesson.domain]}{index === 0 && state.baseline.completed ? " · Recommended first" : lesson.domain === "advanced" ? " · Go further" : ""}</small><strong>{lesson.title}</strong><small>{state.completedLessons.includes(lesson.id) ? "✓ Complete" : `${lesson.minutes} minute lesson`}</small></span><span aria-hidden="true">{selected.id === lesson.id ? "↗" : "→"}</span></button>)}</nav><LessonDetail key={selected.id} lesson={selected} /></div>
  </>;
}
