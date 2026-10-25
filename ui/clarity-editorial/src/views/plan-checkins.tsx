"use client";

import Link from "next/link";
import { useState } from "react";
import { createCheckIn, createRaisePreview, planDemo, raiseDemo, type CheckInMonth, type CheckInResult, type MonthlyPlan, type RaiseResult } from "../api/checkins";
import { Icon } from "../components/icon";

const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

export function PlanCheckinsView({ embedded = false }: { embedded?: boolean }) {
  const [pay, setPay] = useState({ previous: String(raiseDemo.previousMonthlyPay), current: String(raiseDemo.currentMonthlyPay) });
  const [confirmedRecurring, setConfirmedRecurring] = useState(false);
  const [plan, setPlan] = useState<MonthlyPlan | null>(null);
  const [months, setMonths] = useState<CheckInMonth[]>([]);
  const [entry, setEntry] = useState({ saved: "200", dining: "300" });
  const [entryError, setEntryError] = useState("");

  let raise: RaiseResult | null = null;
  let raiseError = "";
  try {
    if (!pay.previous.trim() || !pay.current.trim()) throw new RangeError("Enter both monthly take-home totals.");
    raise = createRaisePreview({ previousMonthlyPay: Number(pay.previous), currentMonthlyPay: Number(pay.current), confirmedRecurring });
  } catch (cause) { raiseError = cause instanceof Error ? cause.message : "Check the pay amounts."; }
  const progress: CheckInResult | null = plan ? createCheckIn({ plan, months }) : null;

  function approve() {
    if (!raise || raise.status !== "review" || raise.suggestedSaving <= 0) return;
    setPlan({ ...planDemo, monthlySaving: raise.suggestedSaving });
    setMonths([]);
  }
  function record() {
    if (!plan) return;
    try {
      if (!entry.saved.trim() || !entry.dining.trim()) throw new RangeError("Complete both fields.");
      const next = [...months, { saved: Number(entry.saved), dining: Number(entry.dining) }];
      createCheckIn({ plan, months: next });
      setMonths(next);
      setEntryError("");
    } catch (cause) { setEntryError(cause instanceof Error ? cause.message : "Check the month entry."); }
  }
  function reset() { setPay({ previous: String(raiseDemo.previousMonthlyPay), current: String(raiseDemo.currentMonthlyPay) }); setConfirmedRecurring(false); setPlan(null); setMonths([]); setEntryError(""); }

  const Heading = embedded ? "h2" : "h1";

  return <div className={`tool-view${embedded ? " is-embedded" : ""}`} id={embedded ? "plan-checkins" : undefined}>
    <header className="view-header"><div><p className="eyebrow">PLAN CHECK-INS / SAVE THE RAISE</p><Heading>Save the raise.<br /><span className="serif-word">Keep the plan.</span></Heading></div><div className="view-header__aside"><span className="tag">MERGED ENGINE / YOUR ENTRIES</span><p>Turn a pay increase into a savings pace, then compare each month with the plan you chose.</p></div></header>
    <p className="inline-notice">Educational illustration. No transfer is created and no budget changes automatically. Entries last for this visit only.</p>
    <div className="tool-layout">
      <section className="panel tool-controls" aria-labelledby="raise-heading"><div className="section-heading"><div><p className="eyebrow">01 / A PAY INCREASE</p><h2 id="raise-heading">Put part of it to work.</h2></div><span className="tag">USD</span></div>
        <div className="field"><label htmlFor="raise-previous">Previous monthly take-home (USD)</label><input id="raise-previous" type="number" min="0" step="0.01" value={pay.previous} disabled={!!plan} onChange={(event) => { setPay((previous) => ({ ...previous, previous: event.target.value })); setConfirmedRecurring(false); }} /></div>
        <div className="field"><label htmlFor="raise-current">New monthly take-home (USD)</label><input id="raise-current" type="number" min="0" step="0.01" value={pay.current} disabled={!!plan} onChange={(event) => { setPay((previous) => ({ ...previous, current: event.target.value })); setConfirmedRecurring(false); }} /></div>
        {raiseError ? <p className="form-error" role="alert">{raiseError}</p> : raise && <>
          {raise.raise > 0 && <label className="consent-checkbox"><input type="checkbox" checked={confirmedRecurring} disabled={!!plan} onChange={(event) => setConfirmedRecurring(event.target.checked)} /><span>I confirm this {usd(raise.raise)} monthly increase is recurring, not a bonus or an extra payday.</span></label>}
          <p role="status">{raise.message}</p>
          <p>Plan: grow {usd(planDemo.startingSavings)} toward {usd(planDemo.goal)} with a {usd(planDemo.diningBudget)} dining budget.</p>
          <button className="button button--primary" type="button" disabled={!!plan || raise.status !== "review" || raise.suggestedSaving <= 0} onClick={approve}>{plan ? `Plan selected: ${usd(plan.monthlySaving)} a month` : "Approve plan"} <Icon name="check" size={16} /></button>
          <p>{raise.assumption}</p>
        </>}
      </section>
      <section className="panel tool-results" aria-labelledby="checkin-heading"><div className="section-heading"><div><p className="eyebrow">02 / HOW DID THIS MONTH GO?</p><h2 id="checkin-heading">Check in. Adjust gently.</h2></div><span className="tag">TRANSPARENT CALCULATION</span></div>
        {!plan || !progress ? <div className="empty-state"><Icon name="shield" size={28} /><h3>Plan first. Check in second.</h3><p>Confirm a recurring raise and approve the plan so there is a savings pace to compare against.</p></div> : <>
          <p>Month {months.length + 1} · planned saving {usd(plan.monthlySaving)}. Enter a complete month; these are your entries, not bank imports.</p>
          <div className="field"><label htmlFor="checkin-saved">Net savings added (USD, negative for withdrawals)</label><input id="checkin-saved" type="number" step="0.01" value={entry.saved} onChange={(event) => setEntry((previous) => ({ ...previous, saved: event.target.value }))} /></div>
          <div className="field"><label htmlFor="checkin-dining">Dining spending (USD)</label><input id="checkin-dining" type="number" min="0" step="0.01" value={entry.dining} onChange={(event) => setEntry((previous) => ({ ...previous, dining: event.target.value }))} /></div>
          {entryError && <p className="form-error" role="alert">{entryError}</p>}
          <button className="button button--primary" type="button" disabled={months.length >= 120} onClick={record}>Save month {months.length + 1} <Icon name="check" size={16} /></button>
          {months.length > 0 && <>
            <div className="tool-message" role="status" aria-live="polite"><p className="eyebrow">AFTER {months.length} {months.length === 1 ? "MONTH" : "MONTHS"}</p><h3>{progress.message}</h3><p>{progress.adjustment}</p></div>
            <div className="tool-metrics"><div><span className="eyebrow">SAVED SO FAR</span><strong>{usd(progress.actualSavings)}</strong></div><div><span className="eyebrow">PLANNED BY NOW</span><strong>{usd(progress.plannedSavings)}</strong></div><div><span className="eyebrow">MONTHS STILL TO GO</span><strong>{progress.actualRemaining ?? "Unavailable"}</strong></div><div><span className="eyebrow">VERSUS ORIGINAL FORECAST</span><strong>{progress.monthsAhead === null ? "Unavailable" : `${Math.abs(progress.monthsAhead)} ${progress.monthsAhead >= 0 ? "ahead" : "behind"}`}</strong></div></div>
            <details className="assumptions"><summary>Recorded months and assumptions <Icon name="plus" size={16} /></summary><div><ul>{months.map((month, index) => <li key={index}>Month {index + 1}: saved {usd(month.saved)} · dining {usd(month.dining)}</li>)}</ul><p>{progress.assumption}</p></div></details>
            <button className="button button--ghost" type="button" onClick={() => setMonths(months.slice(0, -1))}>Undo last entry</button>
          </>}
        </>}
        <button className="button button--ghost" type="button" onClick={reset}>Reset check-in example <Icon name="refresh" size={15} /></button>
      </section>
    </div>
    {!embedded && <div className="quiz-actions"><Link className="button button--secondary" href="/future-lab#stress-test">Run a stress test <Icon name="arrow-right" size={16} /></Link><Link className="button button--ghost" href="/future-lab">Back to Future Lab <Icon name="arrow-up-right" size={16} /></Link></div>}
  </div>;
}
