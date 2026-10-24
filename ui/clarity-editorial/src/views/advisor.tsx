"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { advisorDemo, createAdvisorPlan, getAdvisorSignals, type AdvisorMoment } from "../api/advisor";
import { Icon } from "../components/icon";
import { currency } from "../lib/finance";
import { useDemo } from "../state/demo-store";

type InputKey = "income" | "expenses" | "cash" | "annualRate";
const defaults: Record<InputKey, string> = { income: "4800", expenses: "3580", cash: "5100", annualRate: "4" };
const controls: { key: InputKey; label: string; hint: string; max: number }[] = [
  { key: "income", label: "Monthly take-home income", hint: "After taxes and deductions", max: 1_000_000 },
  { key: "expenses", label: "Monthly expenses", hint: "Include required debt payments and recurring bills", max: 1_000_000 },
  { key: "cash", label: "Accessible cash", hint: "Sample cash available for bills and a cushion", max: 10_000_000 },
  { key: "annualRate", label: "Illustrative annual rate (%)", hint: "An assumption, not a live savings offer", max: 100 },
];
const momentLabels: Record<AdvisorMoment, string> = {
  "new-job": "A possible job change", moving: "A possible move", overspending: "A spending change",
  "student-loan": "A possible loan payment", "idle-cash": "A growing cash cushion",
};
const amountLabels: Record<AdvisorMoment, string> = {
  "new-job": "Sample payroll deposit", moving: "Housing outflow", overspending: "Spending above baseline",
  "student-loan": "Loan outflow", "idle-cash": "Latest sample balance",
};

function targetDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function AdvisorView() {
  const router = useRouter();
  const { update } = useDemo();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [drafts, setDrafts] = useState(defaults);
  const signals = getAdvisorSignals();
  const selected = signals.find((signal) => signal.id === selectedId);
  const errors: Partial<Record<InputKey, string>> = {};
  for (const control of controls) {
    const raw = drafts[control.key];
    const value = Number(raw);
    if (!raw.trim() || !Number.isFinite(value) || value < 0 || value > control.max) {
      errors[control.key] = `Enter a number from 0 to ${control.key === "annualRate" ? "100%" : currency(control.max)}.`;
    }
  }
  const valid = Object.keys(errors).length === 0;
  const inputs = { income: Number(drafts.income), expenses: Number(drafts.expenses), cash: Number(drafts.cash), annualRate: Number(drafts.annualRate) };
  const plan = selected && confirmed && valid ? createAdvisorPlan(selected.kind, inputs) : null;

  function choose(id: string) { setSelectedId(id); setConfirmed(false); }

  function dismiss() {
    if (!selected) return;
    setDismissed((previous) => [...new Set([...previous, selected.id])]);
    setSelectedId(null);
    setConfirmed(false);
  }

  function propose() {
    if (!selected || !confirmed || !valid || !plan || plan.monthly <= 0) return;
    const at = new Date().toISOString();
    update((previous) => ({
      ...previous,
      actions: [{
        id: crypto.randomUUID(), kind: "goal", title: `Review saving ${currency(plan.monthly)} a month`,
        summary: `Review an illustrative ${currency(plan.monthly)} monthly savings amount for ${momentLabels[selected.kind].toLowerCase()}. Sample inputs: ${currency(inputs.income)} monthly take-home income, ${currency(inputs.expenses)} monthly expenses, ${currency(inputs.cash)} accessible cash, and ${inputs.annualRate}% illustrative annual rate. The advisor uses a three-month-expense cushion heuristic and half of available surplus, capped at half of a positive cushion gap. The rate illustration assumes simple annual interest, no taxes or fees. Activity source: synthetic fixture as of ${advisorDemo.asOf}. Approval records a local demo choice only; no transfer, account change, or reminder is made.`,
        amount: plan.monthly, dueDate: targetDate(), status: "pending", createdAt: at,
      }, ...previous.actions],
      activity: [{ id: crypto.randomUUID(), title: "Advisor proposal drafted", detail: `${currency(plan.monthly)} monthly sample amount · confirmed sample moment · awaiting a separate decision`, at }, ...previous.activity],
    }));
    router.push("/approach#proposals");
  }

  return <div className="advisor-view">
    <header className="view-header">
      <div><p className="eyebrow">THE ADVISOR / A POSSIBLE NEXT CHAPTER</p><h1>Notice a change.<br /><span className="serif-word">Choose the next step.</span></h1></div>
      <div className="view-header__aside"><span className="tag">LOCAL RULES / SYNTHETIC ACTIVITY</span><p>A signal starts a conversation. You decide whether it fits before any planning begins.</p></div>
    </header>

    <div className="inline-notice advisor-source-note"><Icon name="sparkles" size={18} /><div><strong>{advisorDemo.label} · as of {advisorDemo.asOf}</strong><p>Five transparent rules read this fixed sample history locally. No bank is connected, no account is monitored, and no notification is delivered.</p></div></div>

    <section aria-labelledby="advisor-signals-heading">
      <div className="section-heading"><div><p className="eyebrow">PATTERNS WORTH A QUESTION</p><h2 id="advisor-signals-heading">Possible moments.<br />Never assumptions about you.</h2></div><span className="tag">{signals.length} SAMPLE SIGNALS</span></div>
      <p className="section-description">These possibilities come from the supplied history, not verified life events. Sparse records, bonuses, irregular expenses, and merchant name changes can mislead a detector.</p>
      <div className="advisor-signals">{signals.map((signal, index) => {
        const isDismissed = dismissed.includes(signal.id);
        return <button key={signal.id} type="button" className={`advisor-signal ${selectedId === signal.id ? "is-selected" : ""} ${isDismissed ? "is-dismissed" : ""}`} aria-label={`Review ${momentLabels[signal.kind].toLowerCase()}`} aria-pressed={selectedId === signal.id} disabled={isDismissed} onClick={() => choose(signal.id)}>
          <span className="advisor-signal__number"><span className="eyebrow">0{index + 1} / POSSIBLE MOMENT</span><Icon name={isDismissed ? "close" : "arrow-up-right"} size={17} /></span>
          <strong>{momentLabels[signal.kind]}</strong><span>{signal.title}</span>
          <span className="advisor-signal__evidence">{signal.evidence}</span>
          <span className="advisor-signal__amount"><small>{amountLabels[signal.kind]}</small><strong>{currency(signal.amount)}</strong></span>
          <span className="tag">{isDismissed ? "DOES NOT FIT / THIS VISIT" : selectedId === signal.id ? "SELECTED FOR REVIEW" : "REVIEW THE SIGNAL"}</span>
        </button>;
      })}</div>
      {dismissed.length > 0 && <button className="button button--ghost" type="button" onClick={() => setDismissed([])}>Restore dismissed sample signals <Icon name="refresh" size={15} /></button>}
    </section>

    <section className="panel advisor-confirmation" aria-labelledby="advisor-confirm-heading">
      <div><p className="eyebrow">FIRST, YOUR INTERPRETATION</p><h2 id="advisor-confirm-heading">{selected ? momentLabels[selected.kind] : "A pattern needs context."}</h2><p>{selected ? selected.message : "Select a signal above to inspect the evidence. Planning stays closed until you explicitly confirm a sample moment."}</p>{selected && <p className="caption">Evidence from the sample: {selected.evidence}</p>}</div>
      {selected && <div><div className="quiz-actions"><button className="button button--primary" type="button" disabled={confirmed} onClick={() => setConfirmed(true)}>{confirmed ? "✓ Sample moment confirmed" : "Confirm this sample moment"}</button><button className="button button--secondary" type="button" onClick={dismiss}>This does not fit <Icon name="close" size={15} /></button></div><p className="field-hint">Confirmation opens an illustration. It does not approve an action.</p></div>}
    </section>

    <div className="advisor-layout">
      <section className="panel advisor-inputs" aria-labelledby="advisor-inputs-heading"><div className="section-heading"><div><p className="eyebrow">SET THE ASSUMPTIONS</p><h2 id="advisor-inputs-heading">The numbers to work with.</h2></div><span className="tag">SAMPLE / USD</span></div>
        <p>Use illustrative amounts. Expenses include required debt payments; the rate is a simple annual assumption.</p>
        {controls.map((control) => <div className="field" key={control.key}><label htmlFor={`advisor-${control.key}`}>{control.label}</label><input id={`advisor-${control.key}`} type="number" min="0" max={control.max} step={control.key === "annualRate" ? "0.1" : "0.01"} value={drafts[control.key]} disabled={!confirmed} aria-invalid={!!errors[control.key]} aria-describedby={`advisor-${control.key}-hint${errors[control.key] ? ` advisor-${control.key}-error` : ""}`} onChange={(event) => setDrafts((previous) => ({ ...previous, [control.key]: event.target.value }))} /><p className="field-hint" id={`advisor-${control.key}-hint`}>{control.hint}</p>{errors[control.key] && <p className="form-error" id={`advisor-${control.key}-error`} role="alert">{errors[control.key]}</p>}</div>)}
      </section>

      <section className="panel advisor-plan" aria-labelledby="advisor-plan-heading">
        <p className="eyebrow">A TRANSPARENT ILLUSTRATION</p><h2 id="advisor-plan-heading">Room for a next step.</h2>
        {!confirmed || !selected ? <div className="empty-state"><Icon name="shield" size={28} /><h3>Confirm the context first.</h3><p>Pick a possible moment and confirm it to see a sample plan. Nothing has been inferred about your real finances.</p></div> : !valid || !plan ? <div className="inline-notice" role="status"><strong>Check the sample inputs.</strong><p>The illustration is paused while an input is invalid. Correct the marked field to calculate a new plan; no prior result can be proposed.</p></div> : <>
          <div className="advisor-plan-metrics" aria-live="polite"><div><span className="eyebrow">MONTHLY SURPLUS</span><strong>{currency(plan.surplus)}</strong><small>Income minus expenses, floored at zero</small></div><div><span className="eyebrow">THREE-MONTH CUSHION GAP</span><strong>{currency(plan.gap)}</strong><small>Three months of expenses minus cash</small></div><div><span className="eyebrow">ILLUSTRATIVE MONTHLY SAVING</span><strong>{currency(plan.monthly)}</strong><small>A heuristic to review, not an affordability claim</small></div><div><span className="eyebrow">SIMPLE ANNUAL INTEREST</span><strong>{currency(plan.interest)}</strong><small>On unchanged sample cash at {inputs.annualRate}%</small></div></div>
          <div className="advisor-plan-explanation"><h3>Context for this moment.</h3><p>{plan.explanation}</p><p className="caption">Engine suggestion: {plan.action}. In this edition, this creates a proposal for a separate decision only.</p></div>
          {plan.monthly === 0 && <p className="inline-notice">There is no positive sample savings amount to propose. Review the expenses and required payments before considering a contribution.</p>}
        </>}
        <button className="button button--primary" type="button" disabled={!plan || plan.monthly <= 0 || !valid || !confirmed} onClick={propose}>Review this savings proposal <Icon name="arrow-up-right" size={17} /></button><p className="field-hint">A pending local proposal only. Approval remains a separate, explicit choice.</p>
      </section>
    </div>

    <details className="panel assumptions advisor-assumptions"><summary>The rules behind this illustration <Icon name="plus" size={18} /></summary><div><ul><li>Monthly surplus = max(0, take-home income − monthly expenses).</li><li>Cushion gap = max(0, expenses × 3 − accessible cash). Three months is an illustrative heuristic, not an individualized emergency-fund target.</li><li>Monthly saving = half the smaller of surplus and a positive cushion gap. If the gap is zero, use half of surplus. Round to whole dollars.</li><li>Simple annual interest = cash × annual rate ÷ 100, rounded to whole dollars. Cash and rate stay constant; compounding, taxes, fees, and withdrawals are excluded.</li><li>All five moments use the same arithmetic with different educational explanations. The engine does not optimize retirement contributions, rank debt versus investing, or execute transfers.</li><li>Spending compares the current month to the three latest earlier active spending months. The cash signal uses four distinct monthly snapshots, which need not be consecutive.</li><li>“New” means first observed in this limited sample. Balance snapshots are supplied separately and are not reconstructed from transactions.</li></ul><p>The detector and planner run from the merged project module. Live authenticated activity, monitoring, and notification delivery have not been connected.</p></div></details>

    <details className="panel assumptions advisor-source-data"><summary>Inspect the synthetic activity <Icon name="plus" size={18} /></summary><div><p>Fixed sample as of {advisorDemo.asOf}. Positive transaction amounts are inflows; negative amounts are outflows. Signal amounts describe observed activity and are not proposed transfers.</p><div className="table-scroll"><table className="comparison-table"><caption>Sample transactions supplied to the merged detector</caption><thead><tr><th scope="col">Date</th><th scope="col">Merchant</th><th scope="col">Category</th><th scope="col">Amount</th></tr></thead><tbody>{advisorDemo.transactions.map((transaction) => <tr key={transaction.id}><td>{transaction.date}</td><td>{transaction.merchant}</td><td>{transaction.category.replaceAll("_", " ")}</td><td>{currency(transaction.amount)}</td></tr>)}</tbody></table></div><div className="table-scroll"><table className="comparison-table"><caption>Separately supplied sample cash snapshots</caption><thead><tr><th scope="col">Date</th><th scope="col">Cash balance</th></tr></thead><tbody>{advisorDemo.snapshots.map((snapshot) => <tr key={snapshot.date}><td>{snapshot.date}</td><td>{currency(snapshot.balance)}</td></tr>)}</tbody></table></div></div></details>
  </div>;
}
