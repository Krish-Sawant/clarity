"use client";

import Link from "next/link";
import { useState } from "react";
import { createCardReadiness, unansweredReadiness, type Readiness } from "../api/credit";
import { Icon } from "../components/icon";

const questions: { key: keyof Readiness; label: string; options: [Readiness[keyof Readiness], string][] }[] = [
  { key: "repayment", label: "1. How do you handle card balances?", options: [["unknown", "Choose / not sure"], ["full", "I pay the full statement balance by its due date"], ["carry", "I carry a balance between months"], ["first-card", "First card: I plan and can afford to pay in full"]] },
  { key: "missedPayments", label: "2. Have you missed a required payment in the last 6 months?", options: [["unknown", "Choose / not sure"], ["no", "No"], ["yes", "Yes"]] },
  { key: "historyConfirmed", label: "3. Does this activity cover your full, typical purchase spending for these three months?", options: [["unknown", "Choose / not sure"], ["yes", "Yes, the history is complete and representative"], ["no", "No, spending or accounts are missing"]] },
];
const usd = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export function CardReadinessView() {
  const [readiness, setReadiness] = useState<Readiness>(unansweredReadiness);
  const [includeInterestExample, setIncludeInterestExample] = useState(false);
  const [momentConfirmed, setMomentConfirmed] = useState(false);
  let output: ReturnType<typeof createCardReadiness> | null = null;
  let error = "";
  try { output = createCardReadiness({ readiness, includeInterestExample }); }
  catch (cause) { error = cause instanceof Error ? cause.message : "Please check the supplied activity."; }
  const result = output?.result;

  function reset() { setReadiness(unansweredReadiness); setIncludeInterestExample(false); setMomentConfirmed(false); }

  return <div className="tool-view">
    <header className="view-header"><div><p className="eyebrow">CARD READINESS / HABITS BEFORE REWARDS</p><h1>A card that fits?<br /><span className="serif-word">Start with your habits.</span></h1></div><div className="view-header__aside"><span className="tag">MERGED ENGINE / SYNTHETIC ACTIVITY</span><p>Your existing spending supplies the numbers. Three answers decide whether comparing rewards makes sense at all.</p></div></header>
    <p className="inline-notice">Illustrative card profiles only. They are not issuer products, live offers or approval predictions, and nothing is applied for.</p>
    {output?.moment && <section className="panel tool-signal" aria-labelledby="card-moment-heading"><div><p className="eyebrow">SYNTHETIC ACTIVITY / POSSIBLE MOMENT</p><h2 id="card-moment-heading">{output.moment.title}</h2><p>{output.moment.message}</p><p className="caption">{output.moment.evidence}</p></div><button className="button button--secondary" type="button" onClick={() => { setMomentConfirmed(true); document.getElementById("card-repayment")?.focus(); }}>{momentConfirmed ? "Continue readiness check" : "Yes, explore readiness"} <Icon name="arrow-up-right" size={16} /></button></section>}
    {error ? <p className="form-error" role="alert">{error}</p> : result && output && <div className="tool-layout">
      <section className="panel tool-controls" aria-labelledby="card-activity-heading"><div className="section-heading"><div><p className="eyebrow">WHAT TRANSACTIONS TELL US</p><h2 id="card-activity-heading">Three complete months.</h2></div><span className="tag">SAMPLE / USD</span></div>
        <p>{result.analysis.startDate} through the day before {result.analysis.endExclusive}. Current-month purchases are excluded.</p>
        <div className="table-scroll"><table className="comparison-table"><caption>Average monthly eligible spending</caption><thead><tr><th scope="col">Category</th><th scope="col">USD / month</th></tr></thead><tbody>{result.analysis.spending.map((row) => <tr key={row.category}><th scope="row">{row.category}</th><td>{usd(row.monthlyCents)}</td></tr>)}</tbody></table></div>
        <p>{usd(result.analysis.excludedOutflowCents)} of outflows excluded across the period, including rent, transfers and debt payments.</p>
        {result.analysis.unknownOutflowCents > 0 && <p className="form-error">{usd(result.analysis.unknownOutflowCents)} needs categorization before a comparison.</p>}
        {result.analysis.refundExcessCents > 0 && <p>Refunds exceeded purchases in a category; that category is floored at zero for this estimate.</p>}
        <details className="assumptions"><summary>See the transaction evidence <Icon name="plus" size={16} /></summary><div><ul>{output.activity.map((item) => <li key={item.id}>{item.date} · {item.merchant} · {usd(Math.round(item.amount * 100))} · {item.category}</li>)}</ul></div></details>
        <label className="consent-checkbox"><input type="checkbox" checked={includeInterestExample} onChange={(event) => setIncludeInterestExample(event.target.checked)} /><span>Try a detected interest-charge example</span></label>
      </section>
      <section className="panel tool-results" aria-labelledby="card-results-heading"><div className="section-heading"><div><p className="eyebrow">WHAT TRANSACTIONS CANNOT TELL US</p><h2 id="card-results-heading">Three honest answers.</h2></div><span className="tag">LOCAL CALCULATION</span></div>
        {questions.map((question) => <div className="field" key={question.key}><label htmlFor={`card-${question.key}`}>{question.label}</label><select id={`card-${question.key}`} value={readiness[question.key]} onChange={(event) => setReadiness((previous) => ({ ...previous, [question.key]: event.target.value }))}>{question.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>)}
        <button className="button button--ghost" type="button" onClick={reset}>Reset answers <Icon name="refresh" size={15} /></button>
        <div className="tool-message" role="status" aria-live="polite" aria-atomic="true"><p className="eyebrow">READINESS</p><h3>{result.message}</h3><ul>{result.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>
        {result.status === "not_yet" && <p className="inline-notice">No rewards-card comparison for now. This is a conservative demo rule, not a credit decision or a diagnosis of your finances.</p>}
        {result.status === "compare" && <><p>Estimated annual rewards after the annual fee, before interest or other costs.</p><div className="decision-summary">{result.estimates.map((card) => <div className="decision-summary-card" key={card.id}><h3>{card.name}</h3><strong>{usd(card.netCents)}</strong><p>{usd(card.grossCents)} rewards − {usd(card.feeCents)} annual fee, per year{result.leadingProfileIds.includes(card.id) ? " · highest modeled net rewards among these examples, not an eligibility recommendation" : ""}</p><details><summary>Show the math and category caps</summary><ul>{card.breakdown.map((row) => <li key={row.category}>{row.category}: {usd(row.annualCents)} annualized; {row.bonusSpendCents > 0 ? `${usd(row.bonusSpendCents)} × ${row.bonusBps / 100}% + ` : ""}{usd(row.baseSpendCents)} × {row.baseBps / 100}% = {usd(row.rewardCents)}</li>)}</ul></details></div>)}</div></>}
        <h3>A useful next step</h3><ul>{result.nextSteps.map((step) => <li key={step}>{step}</li>)}</ul>
        <details className="assumptions"><summary>Why you can trust this comparison <Icon name="plus" size={16} /></summary><div><p>Spending and rewards are calculated locally. Readiness answers are yours; they are not inferred from a paycheck or credit score. No live AI or retrieval is connected.</p><ul>{result.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>{result.sources.map((source) => <p key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> — {source.note} Reviewed {source.reviewed}.</p>)}</div></details>
      </section>
    </div>}
    <div className="quiz-actions"><Link className="button button--secondary" href="/loan-comfort">Compare loan comfort <Icon name="arrow-right" size={16} /></Link><Link className="button button--ghost" href="/advisor">Back to the Advisor <Icon name="arrow-up-right" size={16} /></Link></div>
  </div>;
}
