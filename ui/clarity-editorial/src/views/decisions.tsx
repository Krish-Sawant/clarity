"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createDecisionSession, decisionCities, getDecisionResult, getDecisionScenario, readDecisionField, runDecisionChat, type ChartMetric, type ChatItem, type CitedSource, type DecisionResult, type GuideMode, type LoopEvent, type Session, type Values } from "../api/decisions";
import { Icon } from "../components/icon";
import { currency } from "../lib/finance";
import { DecisionBlock, DecisionBreakdown, DecisionChart, DecisionSummary, DecisionTable, decisionMetricLabels } from "./decision-blocks";

type Draft = Record<string, number | string | boolean>;
type ConversationTurn = { id: number; text: string; events: LoopEvent[]; error?: string; mode?: GuideMode; fallbackReason?: string | null; sources?: CitedSource[] };
const groups = ["a", "b", "shared"] as const;
// The comparison panels appear once the guide has actually run the numbers, not while it's still asking.
const RESULT_TOOLS = new Set(["run_simulation", "show_playground", "show_chart", "show_table", "show_breakdown", "explain"]);

/** Assistant text with [source-id] markers turned into numbered links to the cited page. */
function CitedText({ text, sources }: { text: string; sources: CitedSource[] }) {
  const parts = text.split(/\s?\[([a-z0-9-]+)\]/g);
  return <p>{parts.map((part, index) => {
    if (index % 2 === 0) return part;
    const n = sources.findIndex((s) => s.source_id === part);
    return n < 0 ? null : <sup key={index}><a href={sources[n].url} target="_blank" rel="noopener noreferrer" title={sources[n].title}>[{n + 1}]</a></sup>;
  })}</p>;
}

function MonthlyTable({ result }: { result: DecisionResult }) {
  return <div className="table-scroll"><table className="comparison-table"><caption>Returned monthly schedules · USD rounded to cents for display</caption><thead><tr><th scope="col">Month</th><th scope="col">A cash</th><th scope="col">B cash</th><th scope="col">A debt</th><th scope="col">B debt</th><th scope="col">A net worth</th><th scope="col">B net worth</th></tr></thead><tbody>{result.comparison.a.points.map((point, index) => {
    const other = result.comparison.b.points[index];
    return <tr key={point.month}><th scope="row">{point.month}</th><td>{currency(point.cash)}</td><td>{currency(other.cash)}</td><td>{currency(point.debt)}</td><td>{currency(other.debt)}</td><td>{currency(point.netWorth)}</td><td>{currency(other.netWorth)}</td></tr>;
  })}</tbody></table></div>;
}

export function DecisionsView() {
  // No comparison until the guide picks a scenario from the conversation.
  const [session, setSession] = useState<Session | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [years, setYears] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [inputError, setInputError] = useState("");
  const [metric, setMetric] = useState<ChartMetric>("netWorth");
  const [inspectionMonth, setInspectionMonth] = useState(0);
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [chatError, setChatError] = useState("");
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const pendingRef = useRef(false);
  const history = useRef<ChatItem[]>([]);
  const chatSession = useRef<Session | null>(null);
  const revision = useRef(0);
  const nextTurn = useRef(0);
  const workspace = useRef<HTMLDivElement>(null);
  const messageInput = useRef<HTMLInputElement>(null);
  const scenario = session ? getDecisionScenario(session.scenarioId) : null;
  useEffect(() => () => { revision.current += 1; }, []);
  // The input is disabled while the guide works, which drops focus; hand it back for the next reply.
  const conversationStarted = turns.length > 0;
  useEffect(() => { if (!pending && conversationStarted) messageInput.current?.focus({ preventScroll: true }); }, [pending, conversationStarted]);

  let result: DecisionResult | null = null;
  let calculationError = inputError;
  if (session && !inputError) {
    try { result = getDecisionResult(session); }
    catch (error) { calculationError = error instanceof Error ? error.message : "The comparison could not be calculated."; }
  }

  function resetConversation() {
    if (pendingRef.current) return;
    revision.current += 1;
    history.current = [];
    chatSession.current = null;
    setTurns([]);
    setChatError("");
    setMessage("");
    setSession(null);
    setReady(false);
    setDraft({});
    setYears("");
    setFieldErrors({});
    setInputError("");
  }

  function loadSession(next: Session) {
    if (pendingRef.current) return;
    setSession(next);
    setDraft({ ...next.values });
    setYears(String(next.years));
    setFieldErrors({});
    setInputError("");
    setInspectionMonth(0);
  }

  function validateEditor(values: Draft, horizon: string) {
    if (!scenario) return;
    const errors: Record<string, string> = {};
    for (const field of scenario.fields) {
      try { readDecisionField(field, values[field.key]); }
      catch (error) { errors[field.key] = error instanceof Error ? error.message : "Review this input."; }
    }
    setFieldErrors(errors);
    try {
      const valid = createDecisionSession(scenario.id, values, horizon);
      setSession(valid);
      setInputError("");
    } catch (error) { setInputError(error instanceof Error ? error.message : "Review the comparison inputs."); }
  }

  function changeField(key: string, value: string | boolean) {
    if (!scenario || !session) return;
    const next: Draft = { ...draft, [key]: value };
    const field = scenario.fields.find((item) => item.key === key)!;
    try {
      const parsed = readDecisionField(field, value);
      Object.assign(next, scenario.derive?.(key, { ...session.values, [key]: parsed } as Values));
    } catch { /* Preserve an invalid draft so the user can correct it. */ }
    setDraft(next);
    validateEditor(next, years);
  }

  function changeYears(raw: string) { setYears(raw); validateEditor(draft, raw); }

  async function send(text: string) {
    if (pendingRef.current || calculationError) return;
    if (!text.trim() || text.trim().length > 1200) { setChatError("Ask a question using 1–1,200 characters."); return; }
    pendingRef.current = true;
    setPending(true);
    setChatError("");
    setMessage("");
    const token = revision.current;
    const id = ++nextTurn.current;
    const base = chatSession.current?.scenarioId ? session : null;
    setTurns((previous) => [...previous, { id, text: text.trim(), events: [] }]);
    try {
      const output = await runDecisionChat(history.current, base, text, (event) => {
        if (revision.current !== token) return;
        setTurns((previous) => previous.map((turn) => turn.id === id ? { ...turn, events: [...turn.events, event] } : turn));
      });
      if (revision.current !== token) return;
      history.current = output.history;
      chatSession.current = output.session;
      setTurns((previous) => previous.map((turn) => turn.id === id ? { ...turn, mode: output.mode, fallbackReason: output.fallbackReason, sources: output.sources } : turn));
      if (output.events.some((event) => event.kind === "tool" && RESULT_TOOLS.has(event.call.name))) setReady(true);
      if (output.session.scenarioId) {
        setSession(output.session);
        setDraft({ ...output.session.values });
        setYears(String(output.session.years));
        setFieldErrors({});
        setInputError("");
      }
    } catch (error) {
      if (revision.current !== token) return;
      const detail = error instanceof Error ? error.message : "The guide could not complete this turn. Try again.";
      setChatError(detail);
      setTurns((previous) => previous.map((turn) => turn.id === id ? { ...turn, error: detail } : turn));
    } finally {
      if (revision.current === token) { pendingRef.current = false; setPending(false); }
    }
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(message); }

  const inspectedMonth = result ? Math.min(inspectionMonth, result.months) : 0;
  return <div className="decisions-view">
    <header className="view-header"><div><p className="eyebrow">THE FUTURE LAB / DECISION WORKSHOP</p><h1>Two paths.<br /><span className="serif-word">Your perspective.</span></h1></div><div className="view-header__aside"><span className="tag">MERGED LOCAL ENGINE</span><p>Compare a real-life decision with synthetic assumptions. Make the trade-offs visible before you choose.</p></div></header>

    <section className="panel decision-chat" aria-labelledby="decision-chat-title"><div className="section-heading"><div><p className="eyebrow">THINK IT THROUGH, TOGETHER</p><h2 id="decision-chat-title">Tell the guide what you’re deciding.</h2></div><span className="tag">GEMINI · CITES CFPB SOURCES</span></div><p>Describe any choice between two options in your own words. The guide asks a few short follow-ups, builds the comparison below, and then answers your what-ifs.</p>{turns.length > 0 && <div className="decision-chat-toolbar"><button className="text-link" type="button" disabled={pending} onClick={resetConversation}>Start over <Icon name="refresh" size={14} /></button></div>}
      <div className="decision-chat-transcript" aria-label="Guide conversation">{turns.map((turn, index) => <article className="decision-chat-exchange" key={turn.id}><div className="decision-chat-turn is-user"><p className="eyebrow">YOU</p><p>{turn.text}</p></div><div className="decision-chat-turn is-assistant"><p className="eyebrow">{turn.mode === "scripted" ? "SCRIPTED GUIDE (OFFLINE BACKUP)" : "CLARITY GUIDE"}</p>{turn.fallbackReason && <p className="field-hint">{turn.fallbackReason} The scripted backup answered instead; it covers job offers, cars, grad school, moving out, and paying down debt.</p>}{turn.events.map((event, eventIndex) => event.kind === "assistant" ? <CitedText key={eventIndex} text={event.text} sources={turn.sources ?? []} /> : event.kind === "block" ? <DecisionBlock key={eventIndex} block={event.block} showLabel={turn.events.findIndex((item) => item.kind === "block" && "snapshot" in item.block) === eventIndex} interactive={!pending && !calculationError && index === turns.length - 1} onChoose={(choice) => void send(choice)} onLoadSnapshot={(snapshot) => { loadSession(snapshot); workspace.current?.focus(); }} /> : null)}{turn.sources && turn.sources.length > 0 && <ol className="decision-chat-sources" aria-label="Sources">{turn.sources.map((source) => <li key={source.source_id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ol>}{turn.error && <p className="form-error" role="alert">{turn.error}</p>}</div></article>)}</div>
      {pending && <p className="inline-notice" role="status">The guide is thinking it through…</p>}
      {chatError && <p className="form-error" role="alert">{chatError}</p>}
      <form className="decision-chat-form" onSubmit={submitMessage}><label className="field" htmlFor="decision-chat-message"><span>{ready ? "Ask a what-if" : turns.length ? "Your reply" : "What decision are you weighing?"}</span><input id="decision-chat-message" ref={messageInput} type="text" maxLength={1200} value={message} disabled={pending || !!calculationError} placeholder={ready ? "Try “What if…”" : "Describe your decision in a sentence"} onChange={(event) => setMessage(event.target.value)} /></label><button className="button button--primary" type="submit" disabled={pending || !!calculationError || !message.trim()}>Ask the guide <Icon name="arrow-up-right" size={17} /></button></form><p className="field-hint">Your messages are sent to Google’s Gemini API to write replies; don’t include account numbers or other identifiers. Projections are calculated in your browser, and guidance cites CFPB and other U.S. government sources. Educational, not financial advice.</p>
    </section>

    {ready && session && scenario && <><div className="decision-workspace" id="decision-workspace" ref={workspace} tabIndex={-1}>
      <section className="panel decision-controls" aria-labelledby="decision-inputs-title"><div className="section-heading"><div><p className="eyebrow">MAKE THE ASSUMPTIONS YOURS</p><h2 id="decision-inputs-title">The inputs.</h2></div><button className="text-link" type="button" disabled={pending} onClick={() => loadSession(createDecisionSession(scenario.id))}>Reset inputs <Icon name="refresh" size={14} /></button></div><p className="field-hint">All money is in USD. Values you didn’t give the guide are estimates; edit them to match your situation.</p>
        <label className="field decision-horizon" htmlFor="decision-years"><span>Comparison horizon (years)</span><input id="decision-years" type="number" min="1" max="10" step="1" value={years} disabled={pending} aria-invalid={!/^\d+$/.test(years) || Number(years) < 1 || Number(years) > 10} aria-describedby="decision-years-hint" onChange={(event) => changeYears(event.target.value)} /><small id="decision-years-hint" className="field-hint">1–10 whole years. Shorter views do not establish lifetime outcomes.</small></label>
        <div className="decision-field-groups">{groups.filter((group) => scenario.fields.some((field) => field.group === group)).map((group) => <fieldset key={group} className="decision-field-group" disabled={pending}><legend>{group === "shared" ? "Shared starting point" : `${group.toUpperCase()} / ${scenario.groupLabels[group]}`}</legend>{scenario.fields.filter((field) => field.group === group).map((field) => {
          const label = field.key === "savingsApy" ? "Savings rate / yr (approx.)" : field.label;
          const prefix = group === "shared" ? "Shared" : scenario.groupLabels[group];
          const id = `decision-${scenario.id}-${field.key}`;
          return <div className="field decision-field" key={field.key}>
            {field.kind === "toggle" ? <label className="decision-toggle" htmlFor={id}><input id={id} type="checkbox" checked={draft[field.key] === true} aria-label={`${prefix}: ${label}`} onChange={(event) => changeField(field.key, event.target.checked)} /><span>{label}</span></label> : <><label htmlFor={id}>{label}</label>{field.kind === "city" ? <select id={id} data-testid={`decision-field-${field.key}`} aria-label={`${prefix}: ${label}`} value={String(draft[field.key])} onChange={(event) => changeField(field.key, event.target.value)}>{decisionCities.map((city) => <option key={city.value} value={city.value}>{city.label}</option>)}</select> : <input id={id} data-testid={`decision-field-${field.key}`} type="number" inputMode="decimal" min={field.min} max={field.max} step={field.kind === "months" ? 1 : "any"} value={String(draft[field.key])} aria-label={`${prefix}: ${label}`} aria-invalid={!!fieldErrors[field.key]} aria-describedby={fieldErrors[field.key] ? `${id}-error` : undefined} onChange={(event) => changeField(field.key, event.target.value)} />}</>}
            {fieldErrors[field.key] && <p id={`${id}-error`} className="form-error">{fieldErrors[field.key]}</p>}
          </div>;
        })}</fieldset>)}</div>
      </section>

      <section className="panel decision-results" aria-labelledby="decision-results-title"><div className="section-heading"><div><p className="eyebrow">SEE THE TRADE-OFFS</p><h2 id="decision-results-title">A clearer comparison.</h2></div><span className="tag">USD / ESTIMATE</span></div>
        {calculationError || !result ? <div className="inline-notice inline-notice--error" role="alert"><div><strong>Comparison paused.</strong><p>{calculationError} Correct the inputs to calculate a fresh result. The previous projection is hidden.</p></div></div> : <>
          <div className="decision-metric-selection segmented-control" role="group" aria-label="Chart measure">{(["netWorth", "cash", "debt"] as ChartMetric[]).map((item) => <button type="button" key={item} aria-pressed={metric === item} onClick={() => setMetric(item)}>{decisionMetricLabels[item]}</button>)}</div>
          <DecisionSummary result={result} metric={metric} />
          <DecisionChart result={result} metric={metric} />
          <DecisionBreakdown result={result} />
          <div className="decision-timeline"><label htmlFor="decision-month">Inspect month <strong>{inspectedMonth}</strong> of {result.months}</label><input className="range" id="decision-month" type="range" min="0" max={result.months} step="1" value={inspectedMonth} onChange={(event) => setInspectionMonth(Number(event.target.value))} /><div className="decision-inspection-values" aria-live="polite">{[result.comparison.a, result.comparison.b].map((projection, index) => <span key={index}>{index === 0 ? "A" : "B"} / {projection.label}<strong>{currency(projection.points[inspectedMonth][metric])}</strong></span>)}</div></div>
          <DecisionTable result={result} />
          <details className="assumptions decision-monthly-schedule"><summary>Inspect monthly cash, debt, and net worth <Icon name="plus" size={17} /></summary><MonthlyTable result={result} /></details>
        </>}
      </section>
    </div>

    {result && <section className="panel decisions-guidance" aria-labelledby="decision-guidance-title"><div className="section-heading"><div><p className="eyebrow">A NOTE FROM FUTURE YOU</p><h2 id="decision-guidance-title">What the numbers say.</h2></div><span className="tag">CALCULATED / TEMPLATE</span></div>{result.lines.map((line, index) => <p key={index}>{line}</p>)}<details className="assumptions"><summary>The assumptions behind this comparison <Icon name="plus" size={17} /></summary><div><ul>{result.scenario.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}<li>The tax model uses simplified, fixed 2026 single-filer assumptions; it does not calculate your actual tax liability.</li><li>Savings growth uses an annual-rate / 12 approximation. It is not an exact effective-APY conversion.</li><li>Emergency-fund timing uses three times first-month living costs, which can differ from a chosen savings target.</li><li>Projected cash below zero is an unfunded gap. No extra borrowing or future eligibility is guaranteed.</li></ul></div></details></section>}</>}

    <div className="decision-return-link"><Link className="text-link" href="/future-lab">Back to the Future Lab <Icon name="arrow-right" size={16} /></Link><Link className="text-link" href="/approach">Explore our approach <Icon name="arrow-up-right" size={16} /></Link></div>
  </div>;
}
