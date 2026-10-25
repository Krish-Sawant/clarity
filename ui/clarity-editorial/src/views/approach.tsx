"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { branchIntegrationStatus, checkBackendConnection, getConnectionConfig } from "../api/services";
import { Icon } from "../components/icon";
import { sources } from "../data/content";
import { currency } from "../lib/finance";
import type { DemoAction } from "../lib/types";
import { useDemo } from "../state/demo-store";

function dateString(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readableDate(raw: string) {
  return new Date(raw).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function readableTarget(raw: string) {
  return new Date(`${raw}T12:00:00`).toLocaleDateString("en-US", { dateStyle: "long" });
}

export function ApproachView() {
  const { state, update, reset } = useDemo();
  const [kind, setKind] = useState<"goal" | "reminder">("reminder");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("100");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<"title" | "amount" | "date" | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [connection, setConnection] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [showReset, setShowReset] = useState(false);
  const pending = state.actions.filter((action) => action.status === "pending");
  const history = state.actions.filter((action) => action.status !== "pending");

  function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Math.round(Number(amount) * 100) / 100;
    const targetDate = dueDate || dateString(7);
    if (!title.trim() || title.trim().length > 100) {
      setError("Give the proposal a title between 1 and 100 characters.");
      setErrorField("title");
      titleInput.current?.focus();
      return;
    }
    if (kind === "goal" && (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1000000)) {
      setError("Choose a goal amount greater than $0 and no more than $1,000,000.");
      setErrorField("amount");
      amountInput.current?.focus();
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || targetDate < dateString()) {
      setError("Choose today or a future target date.");
      setErrorField("date");
      dateInput.current?.focus();
      return;
    }
    const at = new Date().toISOString();
    const action: DemoAction = {
      id: crypto.randomUUID(), kind, title: title.trim(),
      summary: kind === "goal" ? `Record a practice savings goal of ${currency(parsedAmount)} with a target date of ${readableTarget(targetDate)}. Approval records this choice; it does not move or reserve money.` : `Record a practice reminder for ${readableTarget(targetDate)}. Approval adds it to your history; it does not schedule a notification or contact anyone.`,
      amount: kind === "goal" ? Math.round(parsedAmount * 100) / 100 : 0,
      dueDate: targetDate, status: "pending", createdAt: at,
    };
    update((previous) => ({ ...previous, actions: [action, ...previous.actions], activity: [{ id: crypto.randomUUID(), title: "Proposal created", detail: `${action.title} · awaiting a decision`, at }, ...previous.activity] }));
    setTitle("");
    setError("");
    setErrorField(null);
    setNotice("Your proposal is ready to review. Nothing has been approved.");
  }

  function decide(id: string, decision: "approved" | "denied") {
    if (decision === "approved" && !consent[id]) return;
    const at = new Date().toISOString();
    update((previous) => {
      const action = previous.actions.find((item) => item.id === id);
      if (!action || action.status !== "pending") return previous;
      return { ...previous, actions: previous.actions.map((item) => item.id === id ? { ...item, status: decision, decidedAt: at } : item), activity: [{ id: crypto.randomUUID(), title: decision === "approved" ? "Proposal approved" : "Proposal denied", detail: `${action.title} · recorded here only`, at }, ...previous.activity] };
    });
    setNotice(decision === "approved" ? "Proposal approved. No money was moved and no notification was scheduled." : "Proposal denied. Your choice is recorded in your history.");
  }

  async function checkConnection() {
    setConnection("loading");
    setConnectionMessage("");
    try {
      const config = getConnectionConfig();
      if (!config) {
        setConnection("error");
        setConnectionMessage("A verified backend connection has not been configured for this edition.");
        return;
      }
      await checkBackendConnection();
      setConnection("success");
      setConnectionMessage("The configured health check responded. Authentication and feature routes are still unverified, so this edition stays offline.");
    } catch (cause) {
      setConnection("error");
      setConnectionMessage(cause instanceof Error ? cause.message : "The connection could not be checked. Try again later.");
    }
  }

  return <div className="approach-view">
    <header className="view-header"><div><p className="eyebrow">OUR APPROACH / 05</p><h1>Confidence starts<br />with <span className="serif-word">transparency.</span></h1></div><div className="view-header__aside"><span className="tag">YOUR CHOICES. ALWAYS.</span><p>Understand the reasoning. See the assumptions. Decide what happens next.</p></div></header>

    <section className="trust-principles" aria-label="Our principles"><article className="trust-principle"><span className="eyebrow">01 / UNDERSTAND</span><h2>Show the working.</h2><p>Question scores have visible counts. Simulations use reproducible arithmetic. Every lesson links to its educational sources.</p></article><article className="trust-principle"><span className="eyebrow">02 / MEASURE</span><h2>Make progress honest.</h2><p>Reassessment uses new questions for the same eight concepts. The result measures answers in this session, with no claim of behavior change or a validated literacy score.</p></article><article className="trust-principle"><span className="eyebrow">03 / DECIDE</span><h2>Keep you in control.</h2><p>A proposal is a choice to review. This edition records approvals and denials. It never transfers money, connects a bank, or delivers reminders.</p></article></section>

    <section className="proposal-section" id="proposals" aria-labelledby="proposals-title"><div className="section-heading"><div><p className="eyebrow">YOUR NEXT STEP NEEDS YOUR YES</p><h2 id="proposals-title">Consider. Then decide.</h2></div><span className="tag">YOUR DECISION</span></div><p className="section-description">Practice a small financial intention. Inspect the proposal before you approve or deny it.</p>
      <div className="two-column proposal-layout">
        <form className="panel proposal-form" onSubmit={propose} noValidate><h3>Draft a proposal</h3><div className="field"><label htmlFor="proposal-kind">What would you like to practice?</label><select id="proposal-kind" value={kind} onChange={(event) => setKind(event.target.value as "goal" | "reminder")}><option value="reminder">A reminder</option><option value="goal">A savings goal</option></select></div><div className="field"><label htmlFor="proposal-title">Proposal title</label><input id="proposal-title" ref={titleInput} aria-invalid={errorField === "title"} placeholder={kind === "reminder" ? "Review my spending next week" : "Build a small emergency buffer"} value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} aria-describedby={errorField === "title" ? "proposal-error" : undefined} /></div>{kind === "goal" && <div className="field"><label htmlFor="proposal-amount">Goal amount (USD)</label><input id="proposal-amount" ref={amountInput} aria-invalid={errorField === "amount"} aria-describedby={errorField === "amount" ? "proposal-error" : undefined} type="number" min="0.01" max="1000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>}<div className="field"><label htmlFor="proposal-date">Target date <span className="field-hint">(optional)</span></label><input id="proposal-date" ref={dateInput} aria-invalid={errorField === "date"} aria-describedby={errorField === "date" ? "proposal-error" : undefined} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /><p className="field-hint">If left blank, the proposal uses a date seven days from today.</p></div>{error && <p className="form-error" id="proposal-error" role="alert">{error}</p>}<button className="button button--primary" type="submit">Review proposal <Icon name="arrow-right" size={16} /></button><p className="field-hint">Only a record is created. This step gives no approval.</p></form>
        <div className="pending-proposals"><div className="pending-proposals__heading"><h3>Awaiting your decision</h3><span className="tag">{pending.length} PENDING</span></div>{pending.length === 0 ? <div className="panel empty-state"><Icon name="shield" size={28} /><h3>Your next move is yours.</h3><p>Draft a proposal or explore a savings goal in the Future Lab. It will appear here for review.</p><Link className="text-link" href="/future-lab">Open Future Lab <Icon name="arrow-up-right" size={15} /></Link></div> : pending.map((action) => <article className="panel proposal-card" key={action.id}><div className="proposal-card__top"><span className="eyebrow">{action.kind === "goal" ? "SAVINGS GOAL" : "REMINDER"}</span><span className="tag">AWAITING YOU</span></div><h3>{action.title}</h3><p>{action.summary}</p><dl className="proposal-details">{action.kind === "goal" && <div><dt>Amount</dt><dd>{currency(action.amount)}</dd></div>}<div><dt>Target date</dt><dd>{readableTarget(action.dueDate)}</dd></div><div><dt>Scope</dt><dd>Record only</dd></div><div><dt>External effects</dt><dd>None</dd></div></dl><label className="consent-checkbox"><input type="checkbox" checked={!!consent[action.id]} onChange={(event) => setConsent((previous) => ({ ...previous, [action.id]: event.target.checked }))} /><span>I understand this approval records a choice only. No money will move and no reminder will be sent.</span></label><div className="proposal-buttons"><button type="button" className="button button--primary" disabled={!consent[action.id]} onClick={() => decide(action.id, "approved")}>Approve proposal <Icon name="check" size={16} /></button><button type="button" className="button button--secondary" onClick={() => decide(action.id, "denied")}>Deny proposal <Icon name="close" size={16} /></button></div></article>)}</div>
      </div>{notice && <p className="inline-notice" role="status">{notice}</p>}
    </section>

    <section className="trust-history-grid"><div className="panel"><div className="section-heading"><div><p className="eyebrow">A CLEAR RECORD</p><h2>Your decisions.</h2></div><span className="tag">{history.length} RECORDED</span></div>{history.length === 0 ? <p className="empty-copy">Your approved and denied proposals will appear here.</p> : <ol className="action-history">{history.map((action) => <li key={action.id}><span className={`decision-icon ${action.status}`}><Icon name={action.status === "approved" ? "check" : "close"} size={17} /></span><div><strong>{action.title}</strong><span>{action.status === "approved" ? "Approved" : "Denied"} · recorded{action.decidedAt ? ` · ${readableDate(action.decidedAt)}` : ""}</span></div></li>)}</ol>}</div><div className="panel"><div className="section-heading"><div><p className="eyebrow">THIS SESSION</p><h2>Activity log.</h2></div></div>{state.activity.length === 0 ? <p className="empty-copy">As you explore, this log records the major steps you take.</p> : <ol className="activity-list">{state.activity.slice(0, 12).map((event) => <li key={event.id}><time dateTime={event.at}>{readableDate(event.at)}</time><strong>{event.title}</strong><span>{event.detail}</span></li>)}</ol>}</div></section>

    <section className="connection-section" aria-labelledby="connections-title"><div className="section-heading"><div><p className="eyebrow">THE HONEST STATUS</p><h2 id="connections-title">What’s connected?</h2></div><span className="tag">CURRENT EDITION</span></div><div className="integration-grid"><article className="panel integration-card"><Icon name="shield" size={23} /><h3>Auth0 sign-in</h3><span className="tag">AWAITING INTEGRATION</span><p>This edition has no active sign-in or authenticated session. Avoid real account details.</p></article><article className="panel integration-card"><Icon name="sparkles" size={23} /><h3>Gemini tutor</h3><span className="tag">PREWRITTEN EXPLANATIONS</span><p>Lesson explanations come from Clarity’s educational content. Nothing is sent to Gemini in this edition.</p></article><article className="panel integration-card"><Icon name="chart" size={23} /><h3>In-browser calculations</h3><span className="tag">AVAILABLE</span><p>Scores and simulations recompute from your inputs. They are illustrations rather than official backend results.</p></article></div><details className="panel assumptions technical-status"><summary>Integration status and upcoming tools <Icon name="plus" size={18} /></summary><div><p>No runnable backend HTTP routes were found in this checkout. The connection check uses a health path only when a developer has explicitly configured one. A response never turns on live mode.</p><button className="button button--secondary" type="button" onClick={checkConnection} disabled={connection === "loading"}>{connection === "loading" ? "Checking connection…" : connection === "error" ? "Retry connection check" : "Check backend connection"}<Icon name="refresh" size={15} /></button>{connectionMessage && <p className={`inline-notice ${connection === "error" ? "connection-error" : ""}`} role={connection === "error" ? "alert" : "status"}>{connectionMessage}</p>}<div className="branch-status-list">{branchIntegrationStatus.map((feature) => <article key={feature.id}><div><h3>{feature.title}</h3><span className="tag">{feature.status === "available-local" ? "MERGED ENGINE" : "WAITING ON BRANCH"}</span></div><p>{feature.detail}</p><p className="field-hint">Source: <code>{feature.branch}</code>. {feature.status === "available-local" ? "The merged rules run in your browser." : "This work is not enabled yet."}</p>{feature.status === "available-local" ? <Link className="button button--secondary" href={feature.href}>Explore {feature.title.toLowerCase()} <Icon name="arrow-up-right" size={15} /></Link> : <button className="button button--secondary" type="button" disabled>Awaiting reviewed integration</button>}</article>)}</div></div></details></section>

    <section className="sources-section" aria-labelledby="sources-title"><div className="section-heading"><div><p className="eyebrow">FOLLOW THE EVIDENCE</p><h2 id="sources-title">Good questions.<br />Grounded sources.</h2></div><p>Educational references from the project’s curated source registry. Open the original material to explore further.</p></div><ul className="source-list">{sources.map((source, index) => <li key={source.source_id}><span className="eyebrow">{String(index + 1).padStart(2, "0")}</span><a href={source.url} target="_blank" rel="noopener noreferrer"><span>{source.title}</span><span className="field-hint">{source.publisher} · opens in a new tab</span></a><Icon name="arrow-up-right" size={19} /></li>)}</ul></section>

    <section className="panel privacy-panel"><div><p className="eyebrow">YOUR DATA</p><h2>A fresh start, whenever you want.</h2><p>Answers, habits, exercises, projections, and decisions stay in this browser tab’s session storage. Design preferences are saved separately on this device. No access tokens or API keys are stored.</p></div><div>{showReset ? <div className="reset-confirmation" role="group" aria-label="Confirm clearing your data"><p>Clear all progress and decisions in this tab?</p><button className="button button--secondary" type="button" onClick={() => { reset(); setShowReset(false); setConsent({}); setNotice("Progress cleared. Your design preferences are preserved."); }}>Yes, clear my data</button><button className="button button--ghost" type="button" onClick={() => setShowReset(false)}>Keep my data</button></div> : <button className="button button--secondary" type="button" onClick={() => setShowReset(true)}>Reset my data <Icon name="refresh" size={15} /></button>}</div></section>
  </div>;
}
