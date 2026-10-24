"use client";

import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { calculateDebtPlan, calculateSavingsPlan, dollarsToCents, type DebtComparison, type DebtPlanInputs, type SavingsPlanInputs, type SavingsProjection } from "../api/calculators";
import { Icon } from "../components/icon";
import { currency } from "../lib/finance";

type FieldDefinition = { key: string; label: string; type: "money" | "rate" | "horizon"; hint: string };
type Drafts = Record<string, string>;
const debtFields: FieldDefinition[] = [
  { key: "balance", label: "Debt balance (USD)", type: "money", hint: "The starting amount you owe" },
  { key: "apr", label: "Debt APR (%)", type: "rate", hint: "A fixed annual borrowing rate" },
  { key: "payment", label: "Regular monthly payment (USD)", type: "money", hint: "Paid after each month’s interest" },
  { key: "extraPayment", label: "Extra monthly payment (USD)", type: "money", hint: "An additional fixed amount each month" },
  { key: "maxMonths", label: "Debt projection horizon (months)", type: "horizon", hint: "Between 1 and 1,200 months" },
];
const savingsFields: FieldDefinition[] = [
  { key: "current", label: "Current savings (USD)", type: "money", hint: "Your sample balance at month zero" },
  { key: "target", label: "Savings target (USD)", type: "money", hint: "The balance you want to reach" },
  { key: "monthlyContribution", label: "Monthly contribution (USD)", type: "money", hint: "Added at the end of every month" },
  { key: "apy", label: "Savings APY (%)", type: "rate", hint: "A fixed assumed yield, including compounding" },
  { key: "maxMonths", label: "Savings projection horizon (months)", type: "horizon", hint: "Between 1 and 1,200 months" },
];

function parseDrafts(drafts: Drafts, definitions: FieldDefinition[]) {
  const values: Record<string, number> = {};
  const errors: Record<string, string> = {};
  for (const field of definitions) {
    const raw = drafts[field.key].trim();
    const value = raw === "" ? NaN : Number(raw);
    try {
      if (!Number.isFinite(value) || value < 0) throw new Error("Enter a non-negative number. Blank values are not treated as zero.");
      if (field.type === "money") {
        dollarsToCents(value, field.label);
        if (value > 10_000_000) throw new Error("Use a sample amount no greater than $10,000,000.");
      }
      if (field.type === "rate" && value > 100) throw new Error("Use an illustrative rate from 0 to 100 percent.");
      if (field.type === "horizon" && (!Number.isInteger(value) || value < 1 || value > 1200)) throw new Error("Use a whole number from 1 to 1,200 months.");
      values[field.key] = value;
    } catch (cause) { errors[field.key] = cause instanceof Error ? cause.message : "Check this value."; }
  }
  return { values, errors, valid: Object.keys(errors).length === 0 };
}

function Fields({ prefix, definitions, drafts, errors, onChange }: { prefix: string; definitions: FieldDefinition[]; drafts: Drafts; errors: Record<string, string>; onChange: (key: string, value: string) => void }) {
  return <div className="calculator-fields">{definitions.map((field) => <div className="field" key={field.key}>
    <label htmlFor={`${prefix}-${field.key}`}>{field.label}</label>
    <input id={`${prefix}-${field.key}`} type="number" min={field.type === "horizon" ? 1 : 0} max={field.type === "horizon" ? 1200 : field.type === "rate" ? 100 : 10000000} step={field.type === "horizon" ? 1 : field.type === "money" ? "0.01" : "any"} inputMode={field.type === "horizon" ? "numeric" : "decimal"} value={drafts[field.key]} onChange={(event) => onChange(field.key, event.target.value)} aria-invalid={!!errors[field.key]} aria-describedby={`${prefix}-${field.key}-hint${errors[field.key] ? ` ${prefix}-${field.key}-error` : ""}`} />
    <p className="field-hint" id={`${prefix}-${field.key}-hint`}>{field.hint}</p>
    {errors[field.key] && <p className="form-error" id={`${prefix}-${field.key}-error`}>{errors[field.key]}</p>}
  </div>)}</div>;
}

function duration(months: number | null) {
  return months === null ? "Unavailable" : `${months} ${months === 1 ? "month" : "months"}`;
}

function DebtResult({ result, label, plan }: { result: DebtComparison["baseline"]; label: string; plan: string }) {
  const status = result.status === "paid_off" ? "Paid off in this projection" : result.status === "payment_too_low" ? "Payment does not reduce principal" : "Projection ends before payoff";
  return <section className="panel calculator-result" data-plan={plan} aria-label={label}>
    <p className="eyebrow">{label}</p><h3>{duration(result.monthsToPayoff)}</h3><p className="calculator-status" role="status">{status}</p>
    <dl className="calculator-metrics"><div><dt>Interest in calculated schedule</dt><dd>{currency(result.totalInterestCents / 100)}</dd></div><div><dt>Payments in calculated schedule</dt><dd>{currency(result.totalPaymentsCents / 100)}</dd></div><div><dt>Remaining balance</dt><dd>{currency(result.remainingCents / 100)}</dd></div></dl>
    {result.status === "payment_too_low" && <p className="field-hint">The fixed payment is at or below the first month’s interest. No payoff date is available, and the engine returns no schedule. The $0 scheduled totals cover no completed months; they are not a lifetime cost estimate.</p>}
    {result.status === "horizon_exceeded" && <p className="field-hint">These totals cover {result.schedule.length} calculated months. They are not lifetime payoff costs.</p>}
    {result.status === "paid_off" && result.monthsToPayoff === 0 && <p className="field-hint">The starting balance is already $0. No payments are required in this projection.</p>}
  </section>;
}

function DebtSchedule({ result, label }: { result: DebtComparison["baseline"]; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? result.schedule : result.schedule.slice(0, 12);
  return <details className="panel calculator-schedule"><summary>{label} schedule <Icon name="plus" size={16} /></summary>
    {result.schedule.length === 0 ? <p className="field-hint">No monthly rows: {result.status === "paid_off" ? "the balance is already paid" : "the payment cannot reduce principal"}.</p> : <><div className="table-scroll"><table className="comparison-table"><caption>Actual engine rows · all amounts in USD</caption><thead><tr><th scope="col">Month</th><th scope="col">Opening</th><th scope="col">Interest</th><th scope="col">Payment</th><th scope="col">Closing</th></tr></thead><tbody>{rows.map((row) => <tr key={row.month}><th scope="row">{row.month}</th><td>{currency(row.openingCents / 100)}</td><td>{currency(row.interestCents / 100)}</td><td>{currency(row.paymentCents / 100)}</td><td>{currency(row.closingCents / 100)}</td></tr>)}</tbody></table></div>{result.schedule.length > 12 && <><p className="field-hint">Showing {rows.length} of {result.schedule.length} calculated months.</p><button className="button button--ghost" type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "Show first 12 months" : `Show all ${result.schedule.length} months`}</button></>}</>}
  </details>;
}

function SavingsSchedule({ result }: { result: SavingsProjection }) {
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? result.schedule : result.schedule.slice(0, 12);
  return <details className="panel calculator-schedule"><summary>Savings schedule <Icon name="plus" size={16} /></summary>
    {result.schedule.length === 0 ? <p className="field-hint">No monthly rows: {result.status === "goal_reached" ? "the starting savings already meet the target" : "the supplied interest and contribution create no progress"}.</p> : <><div className="table-scroll"><table className="comparison-table"><caption>Interest then month-end contribution · USD</caption><thead><tr><th scope="col">Month</th><th scope="col">Interest</th><th scope="col">Contribution</th><th scope="col">Closing balance</th></tr></thead><tbody>{rows.map((row) => <tr key={row.month}><th scope="row">{row.month}</th><td>{currency(row.interestCents / 100)}</td><td>{currency(row.contributionCents / 100)}</td><td>{currency(row.closingCents / 100)}</td></tr>)}</tbody></table></div>{result.schedule.length > 12 && <><p className="field-hint">Showing {rows.length} of {result.schedule.length} calculated months.</p><button className="button button--ghost" type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "Show first 12 months" : `Show all ${result.schedule.length} months`}</button></>}</>}
  </details>;
}

export function CalculatorsView() {
  const [activeTab, setActiveTab] = useState<"debt" | "savings">("debt");
  const [debtDrafts, setDebtDrafts] = useState<Drafts>({ balance: "5000", apr: "24", payment: "150", extraPayment: "100", maxMonths: "1200" });
  const [savingsDrafts, setSavingsDrafts] = useState<Drafts>({ current: "1500", target: "6000", monthlyContribution: "250", apy: "4", maxMonths: "120" });
  const debtParsed = parseDrafts(debtDrafts, debtFields);
  const savingsParsed = parseDrafts(savingsDrafts, savingsFields);
  let debtResult: DebtComparison | null = null;
  let savingsResult: SavingsProjection | null = null;
  let calculationError = "";
  try {
    if (activeTab === "debt" && debtParsed.valid) debtResult = calculateDebtPlan(debtParsed.values as DebtPlanInputs);
    if (activeTab === "savings" && savingsParsed.valid) savingsResult = calculateSavingsPlan(savingsParsed.values as SavingsPlanInputs);
  } catch (cause) { calculationError = cause instanceof Error ? cause.message : "The calculation could not be completed."; }
  const valid = activeTab === "debt" ? debtParsed.valid : savingsParsed.valid;

  function tabKeys(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tab = event.key === "Home" ? "debt" : event.key === "End" ? "savings" : activeTab === "debt" ? "savings" : "debt";
    setActiveTab(tab);
    document.getElementById(`calculator-tab-${tab}`)?.focus();
  }

  return <div className="calculators-view">
    <header className="view-header"><div><p className="eyebrow">FUTURE LAB / SHARED CALCULATION TOOLS</p><h1>Small changes.<br /><span className="serif-word">Clearer numbers.</span></h1></div><div className="view-header__aside"><span className="tag">LOCAL DETERMINISTIC TOOL</span><p>Explore a debt payment or a savings target using the team’s actual calculation engine. Change the inputs. Inspect every month.</p></div></header>
    <p className="inline-notice calculator-source"><Icon name="chart" size={16} /> Synthetic examples · Calculated locally with the merged finance engine. No bank, model request or money movement.</p>
    <div className="calculator-tabs segmented-control" role="tablist" aria-label="Choose a calculation">{(["debt", "savings"] as const).map((tab) => <button key={tab} type="button" id={`calculator-tab-${tab}`} role="tab" aria-selected={activeTab === tab} aria-controls={`calculator-panel-${tab}`} tabIndex={activeTab === tab ? 0 : -1} onClick={() => setActiveTab(tab)} onKeyDown={tabKeys}>{tab === "debt" ? "Debt payoff" : "Savings goal"}</button>)}</div>

    <section id={`calculator-panel-${activeTab}`} role="tabpanel" aria-labelledby={`calculator-tab-${activeTab}`} className="calculator-layout">
      <div className="panel calculator-controls"><p className="eyebrow">YOUR SAMPLE ASSUMPTIONS</p><h2>{activeTab === "debt" ? "What could an extra payment change?" : "Give your goal a timeline."}</h2>
        {activeTab === "debt" ? <><Fields prefix="debt" definitions={debtFields} drafts={debtDrafts} errors={debtParsed.errors} onChange={(key, value) => setDebtDrafts((previous) => ({ ...previous, [key]: value }))} /><div className="field"><label htmlFor="debt-extra-slider">Adjust the extra monthly payment</label><input id="debt-extra-slider" type="range" min="0" max={Math.max(1000, Math.ceil((debtParsed.values.extraPayment ?? 0) / 100) * 100)} step="0.01" value={debtParsed.values.extraPayment ?? 0} onChange={(event) => setDebtDrafts((previous) => ({ ...previous, extraPayment: event.target.value }))} /><output>{debtParsed.values.extraPayment === undefined ? "Enter a valid extra amount" : `${currency(debtParsed.values.extraPayment)} extra per month`}</output></div></> : <Fields prefix="savings" definitions={savingsFields} drafts={savingsDrafts} errors={savingsParsed.errors} onChange={(key, value) => setSavingsDrafts((previous) => ({ ...previous, [key]: value }))} />}
        <p className="field-hint">These drafts stay on this page. Use sample values. The calculator does not assess affordability or select a financial product.</p>
      </div>

      <div className="calculator-output">
        {(!valid || calculationError) && <div className="panel calculator-paused" role="alert"><h2>Calculation paused.</h2><p>{calculationError || "Correct the highlighted input to calculate again. Blank or invalid drafts do not produce a forecast."}</p></div>}
        {activeTab === "debt" && debtResult && <><div className="calculator-plan-results"><DebtResult result={debtResult.baseline} label="Current payment" plan="baseline" /><DebtResult result={debtResult.accelerated} label="With extra payment" plan="accelerated" /></div>
          <section className="panel calculator-comparison" aria-label="Extra payment comparison"><p className="eyebrow">THE DIFFERENCE / SAME ASSUMPTIONS</p><h2>{debtResult.monthsSaved === null ? "A full comparison is unavailable." : `${debtResult.monthsSaved} ${debtResult.monthsSaved === 1 ? "month" : "months"} sooner.`}</h2><p>{debtResult.interestSavedCents === null ? "Both plans must pay off within the horizon before lifetime months or interest saved can be compared. Review each plan’s status above." : `${currency(debtResult.interestSavedCents / 100)} less interest. Monthly payment assumption: ${currency(debtParsed.values.payment + debtParsed.values.extraPayment)} versus ${currency(debtParsed.values.payment)}.`}</p><p className="field-hint">The calculation assumes the extra amount is maintained every month. It does not determine whether that payment fits your budget.</p></section>
          <div className="calculator-timeline"><DebtSchedule result={debtResult.baseline} label="Current payment" /><DebtSchedule result={debtResult.accelerated} label="Extra payment" /></div>
          <details className="panel calculator-assumptions"><summary>Debt calculation assumptions <Icon name="plus" size={16} /></summary><ul>{debtResult.baseline.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul><p className="field-hint">Input values are converted from USD dollars to integer cents once. Cards and tables use the same returned schedule. The projection is capped at {debtParsed.values.maxMonths} months.</p></details>
        </>}
        {activeTab === "savings" && savingsResult && <><section className="panel calculator-result calculator-savings-result" aria-label="Savings projection"><p className="eyebrow">TIME TO YOUR SAMPLE TARGET</p><h2>{duration(savingsResult.monthsToGoal)}</h2><p className="calculator-status" role="status">{savingsResult.status === "goal_reached" ? "Goal reached in this projection" : savingsResult.status === "no_progress" ? "No progress under these assumptions" : "Projection ends before the goal"}</p><dl className="calculator-metrics"><div><dt>Final calculated balance</dt><dd>{currency(savingsResult.finalBalanceCents / 100)}</dd></div><div><dt>Interest in calculated schedule</dt><dd>{currency(savingsResult.totalInterestCents / 100)}</dd></div><div><dt>Contributions in calculated schedule</dt><dd>{currency(savingsResult.totalContributionsCents / 100)}</dd></div></dl>{savingsResult.status === "no_progress" && <p>The supplied balance earns no rounded monthly interest and the contribution is $0. There is no goal date to report.</p>}{savingsResult.status === "horizon_exceeded" && <p>After {savingsResult.schedule.length} months, the sample savings have not reached {currency(savingsParsed.values.target)}. The displayed totals cover this horizon only.</p>}{savingsResult.monthsToGoal === 0 && <p>Your starting savings already meet the target. The engine returns zero months and no future deposits.</p>}</section><SavingsSchedule result={savingsResult} /><details className="panel calculator-assumptions"><summary>Savings calculation assumptions <Icon name="plus" size={16} /></summary><ul>{savingsResult.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul><p className="field-hint">APY already includes compounding. The engine converts it to an equivalent monthly rate, rather than dividing it by 12. The assumed rate is not a live account offer.</p></details></>}
      </div>
    </section>
    <div className="calculator-footer"><Link className="text-link" href="/future-lab">Explore cash-flow paths <Icon name="arrow-right" size={15} /></Link><Link className="text-link" href="/approach">Understand our methods <Icon name="arrow-up-right" size={15} /></Link></div>
  </div>;
}
