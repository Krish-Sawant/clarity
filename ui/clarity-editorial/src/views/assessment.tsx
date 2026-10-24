"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { baselineQuestions, checkpointQuestions } from "../data/content";
import { scoreAssessment } from "../lib/assessment";
import { CORE_DOMAINS, DOMAIN_LABELS, type AssessmentStage, type Question } from "../lib/types";
import { useDemo } from "../state/demo-store";

function HabitsSurvey() {
  const { state, update } = useDemo();
  const questions = [
    { id: "tracking", label: "How often do you look at your spending?", options: ["Weekly", "Monthly", "Rarely", "Prefer not to say"] },
    { id: "buffer", label: "Do you have a plan for an unexpected expense?", options: ["Yes", "Working on it", "Not yet", "Prefer not to say"] },
  ];

  if (state.habitsDone) return <div className="inline-notice">Your optional check-in is complete. These self-reported habits never affect your knowledge score.</div>;

  return (
    <section className="panel habits-panel" aria-labelledby="habits-heading">
      <p className="eyebrow">Optional · ungraded</p>
      <h2 id="habits-heading">A little context. No judgment.</h2>
      <p>Use the synthetic demo profile. You can leave either question blank; habits stay separate from the knowledge check.</p>
      <div className="two-column">
        {questions.map((question) => (
          <label className="field" key={question.id}>
            <span>{question.label}</span>
            <select value={state.habits[question.id] ?? ""} onChange={(event) => update((previous) => ({ ...previous, habits: { ...previous.habits, [question.id]: event.target.value } }))}>
              <option value="">Choose, or leave blank</option>
              {question.options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="quiz-actions">
        <button className="button button--secondary" onClick={() => update((previous) => ({ ...previous, habitsDone: true }))}>Save optional check-in</button>
        <button className="button button--ghost" onClick={() => update((previous) => ({ ...previous, habits: {}, habitsDone: true }))}>Skip habits</button>
      </div>
    </section>
  );
}

function Results({ stage, questions }: { stage: AssessmentStage; questions: Question[] }) {
  const { state, update } = useDemo();
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const quiz = state[stage];
  const score = scoreAssessment(questions, quiz.answers);
  const before = scoreAssessment(baselineQuestions, state.baseline.answers);
  const difference = score.correct - before.correct;
  const paired = checkpointQuestions.filter((question) => {
    const baselineAnswer = state.baseline.answers[question.pairs_with ?? ""];
    const checkpointAnswer = state.checkpoint.answers[question.id];
    return typeof baselineAnswer === "string" && typeof checkpointAnswer === "string";
  });
  const pairedBefore = paired.filter((question) => {
    const original = baselineQuestions.find((item) => item.id === question.pairs_with);
    return original && state.baseline.answers[original.id] === original.correct_option_id;
  }).length;
  const pairedAfter = paired.filter((question) => state.checkpoint.answers[question.id] === question.correct_option_id).length;

  useEffect(() => { resultHeading.current?.focus(); }, []);

  return (
    <div className="assessment-results">
      <section className="panel assessment-summary" aria-labelledby="result-heading">
        <div>
          <p className="eyebrow">{stage === "baseline" ? "Your starting point" : "Your second signal"} · local demo</p>
          <h2 id="result-heading" ref={resultHeading} tabIndex={-1}>{stage === "baseline" ? "A signal, not a label." : difference > 0 ? "More ideas are clicking." : difference === 0 ? "Same score. Keep exploring." : "A useful place to revisit."}</h2>
          <p>{stage === "baseline" ? "This is a snapshot of eight concepts, not a measure of your worth or a validated literacy rating. Your learning path starts with the ideas worth another look." : "Different questions. The same eight concepts and difficulty. This comparison describes knowledge responses; it does not establish a change in financial behavior."}</p>
          <div className="quiz-actions">
            <Link className="button button--primary" href={stage === "baseline" ? "/learn" : "/future-lab"}>{stage === "baseline" ? "Build my learning path" : "Try it in Future Lab"} <span aria-hidden="true">↗</span></Link>
            {stage === "checkpoint" && <button className="button button--ghost" onClick={() => update((previous) => ({ ...previous, checkpoint: { answers: {}, index: 0, completed: false } }))}>Try reassessment again</button>}
          </div>
        </div>
        <div className="score-value" aria-label={`${score.correct} correct out of ${score.total}`}>
          <span>{score.correct}<small>/{score.total}</small></span>
          <p>concept questions correct</p>
          <small>{score.answered} answered · {score.skipped} skipped</small>
        </div>
      </section>

      {stage === "checkpoint" && <section className="score-comparison panel" aria-label="Before and after results">
        <div><p className="eyebrow">Baseline</p><strong>{before.correct} / {before.total}</strong></div>
        <span aria-hidden="true">→</span>
        <div><p className="eyebrow">Reassessment</p><strong>{score.correct} / {score.total}</strong></div>
        <div><p className="eyebrow">Change in correct answers</p><strong>{difference > 0 ? "+" : ""}{difference}</strong></div>
        <p className="comparison-caveat">{paired.length} / 8 concepts answered in both checks: {pairedBefore} → {pairedAfter} correct on those pairs. Skips count as zero in the full-check totals. Small samples and repeated exposure limit the conclusions you can draw.</p>
      </section>}

      <section className="panel" aria-labelledby="domain-heading">
        <div className="section-heading"><div><p className="eyebrow">The knowledge signal</p><h2 id="domain-heading">See the concepts, not a percentage.</h2></div><span className="tag">2 questions per topic</span></div>
        {stage === "checkpoint" && <div className="comparison-key"><span>▱ Baseline</span><span>▬ Reassessment</span></div>}
        <div className="domain-results">
          {CORE_DOMAINS.map((domain) => <div className="domain-result" key={domain}>
            <div><strong>{DOMAIN_LABELS[domain]}</strong><span>{stage === "checkpoint" ? `${before.byDomain[domain].correct} → ` : ""}{score.byDomain[domain].correct} / {score.byDomain[domain].total} correct</span></div>
            {stage === "checkpoint" && <div className="score-track score-track--baseline"><span className="score-fill" style={{ width: `${before.byDomain[domain].correct / before.byDomain[domain].total * 100}%` }} /></div>}
            <div className="score-track"><span className="score-fill" style={{ width: `${score.byDomain[domain].correct / score.byDomain[domain].total * 100}%` }} /></div>
          </div>)}
        </div>
      </section>

      {stage === "baseline" && <HabitsSurvey />}

      <details className="panel answer-review">
        <summary>Review all {questions.length} answers and explanations</summary>
        <div>
          {questions.map((question, index) => {
            const selected = quiz.answers[question.id];
            const correct = selected === question.correct_option_id;
            return <article className="review-item" key={question.id}>
              <p className="eyebrow">{String(index + 1).padStart(2, "0")} · {DOMAIN_LABELS[question.domain]} · {correct ? "✓ Correct" : selected == null ? "— Skipped" : "× Revisit"}</p>
              <h3>{question.prompt}</h3>
              <p>Your answer: {question.options.find((option) => option.id === selected)?.text ?? "Skipped"}</p>
              <p><strong>Answer:</strong> {question.options.find((option) => option.id === question.correct_option_id)?.text}</p>
              <p>{question.explanation}</p>
            </article>;
          })}
        </div>
      </details>
    </div>
  );
}

export function AssessmentView({ stage }: { stage: AssessmentStage }) {
  const { state, update, hydrated } = useDemo();
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const questions = stage === "baseline" ? baselineQuestions : checkpointQuestions;
  const quiz = state[stage];
  const index = Math.min(quiz.index, questions.length - 1);
  const question = questions[index];
  const visited = questions.filter((item) => Object.hasOwn(quiz.answers, item.id)).length;

  function goTo(next: number) {
    setError("");
    update((previous) => ({ ...previous, [stage]: { ...previous[stage], index: next } }));
    requestAnimationFrame(() => heading.current?.focus());
  }

  function advance(skip = false) {
    if (!skip && quiz.answers[question.id] === undefined) {
      setError("Choose an answer, or use Skip this question. Skipping is always okay.");
      return;
    }
    const answers = skip ? { ...quiz.answers, [question.id]: null } : quiz.answers;
    const missing = questions.findIndex((item) => !Object.hasOwn(answers, item.id));
    const atEnd = index === questions.length - 1;
    if (atEnd && missing !== -1) {
      update((previous) => ({ ...previous, [stage]: { ...previous[stage], answers, index: missing } }));
      setError("A question is still open. Answer it or explicitly skip it before seeing your results.");
    } else if (atEnd) {
      update((previous) => ({
        ...previous,
        [stage]: { ...previous[stage], answers, completed: true },
        activity: [{ id: crypto.randomUUID(), title: stage === "baseline" ? "Baseline completed" : "Reassessment completed", detail: "Local demo knowledge check; habits excluded from scoring.", at: new Date().toISOString() }, ...previous.activity],
      }));
      setError("");
    } else {
      update((previous) => ({ ...previous, [stage]: { ...previous[stage], answers, index: index + 1 } }));
      setError("");
    }
    requestAnimationFrame(() => heading.current?.focus());
  }

  if (!hydrated) return <div className="panel loading-state" role="status">Restoring your demo check-in…</div>;

  return <>
    <header className="view-header">
      <div><p className="eyebrow">{stage === "baseline" ? "01 / Discover" : "03 / Reassess"}</p><h1>{stage === "baseline" ? <>Start with what<br />you know.</> : <>See what<br />stays with you.</>}</h1></div>
      <p>{stage === "baseline" ? "Eight small questions. A clearer place to begin. No pressure to get everything right." : "A fresh set of questions, matched to your starting concepts. Find out which ideas are beginning to stick."}</p>
    </header>

    {stage === "checkpoint" && !state.baseline.completed ? <section className="panel empty-state"><p className="eyebrow">First, a starting point</p><h2>A comparison needs two signals.</h2><p>Complete Discover so the reassessment can compare the same eight concepts with different questions.</p><Link className="button button--primary" href="/discover">Start Discover <span aria-hidden="true">↗</span></Link></section>
      : quiz.completed ? <Results stage={stage} questions={questions} />
      : <div className="assessment-layout">
        <section className="panel quiz-panel" aria-labelledby="quiz-heading">
          <div className="quiz-heading"><span className="eyebrow">Question {String(index + 1).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}</span><span className="tag">{DOMAIN_LABELS[question.domain]}</span></div>
          <div className="quiz-progress" role="progressbar" aria-label="Questions answered or skipped" aria-valuenow={visited} aria-valuemin={0} aria-valuemax={questions.length}><span style={{ width: `${visited / questions.length * 100}%` }} /></div>
          <h2 id="quiz-heading" ref={heading} tabIndex={-1}>{question.prompt}</h2>
          <fieldset className="answer-list">
            <legend className="sr-only">Choose one answer</legend>
            {question.options.map((option) => <label className={`answer-option ${quiz.answers[question.id] === option.id ? "is-selected" : ""}`} key={option.id}>
              <input type="radio" name={question.id} value={option.id} checked={quiz.answers[question.id] === option.id} onChange={() => {
                setError("");
                update((previous) => ({ ...previous, [stage]: { ...previous[stage], answers: { ...previous[stage].answers, [question.id]: option.id } } }));
              }} />
              <span className="option-letter" aria-hidden="true">{option.id.toUpperCase()}</span><span>{option.text}</span><span className="option-check" aria-hidden="true">{quiz.answers[question.id] === option.id ? "✓" : ""}</span>
            </label>)}
          </fieldset>
          {error && <p className="inline-notice inline-notice--error" role="alert">{error}</p>}
          <div className="quiz-actions">
            <button className="button button--ghost" disabled={index === 0} onClick={() => goTo(index - 1)}><span aria-hidden="true">←</span> Back</button>
            <button className="button button--ghost" onClick={() => advance(true)}>Skip this question</button>
            <button className="button button--primary" onClick={() => advance()}>{index === questions.length - 1 ? "See my results" : "Continue"} <span aria-hidden="true">→</span></button>
          </div>
          <nav className="question-map" aria-label="Question navigation">{questions.map((item, itemIndex) => <button className={`question-dot ${index === itemIndex ? "is-current" : ""} ${typeof quiz.answers[item.id] === "string" ? "is-answered" : quiz.answers[item.id] === null ? "is-skipped" : ""}`} key={item.id} onClick={() => goTo(itemIndex)} aria-current={index === itemIndex ? "step" : undefined} aria-label={`Question ${itemIndex + 1}${typeof quiz.answers[item.id] === "string" ? ", answered" : quiz.answers[item.id] === null ? ", skipped" : ", open"}`}>{String(itemIndex + 1).padStart(2, "0")}{typeof quiz.answers[item.id] === "string" && <span aria-hidden="true"> ✓</span>}{quiz.answers[item.id] === null && <span aria-hidden="true"> —</span>}</button>)}</nav>
        </section>
        <aside className="quiz-aside">
          <div className="panel"><p className="eyebrow">Make room for the unknown</p><h3>“I’m not sure”<br />is a useful answer.</h3><p>Skip any question. You can come back before you finish. Skipped questions stay visible in the results and count as zero in the full-check total.</p><div className="aside-rule" /><p className="eyebrow">Your progress</p><strong>{visited} of {questions.length} visited</strong><p>This tab remembers your demo answers if you refresh.</p></div>
          <div className="inline-notice">Local demo · synthetic educational questions. No financial account connection, official grade, or AI scoring.</div>
          {stage === "checkpoint" && <p className="caption">This uses different prompts with the same concepts, difficulty, and point values as your baseline.</p>}
        </aside>
      </div>}
  </>;
}
