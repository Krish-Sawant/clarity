"use client";

import Link from "next/link";
import { useState } from "react";
import { createLoanComparison, loanDefaults, type LoanComfortResult } from "../api/loan";
import { Icon } from "../components/icon";

type Field = "monthlyTakeHome" | "monthlySpending" | "monthlyLoanPayments" | "savings" | "aprPercent" | "termMonths" | "grossMonthly";
const controls: { key: Field; label: string; hint: string; step: string }[] = [
  { key: "monthlyTakeHome", label: "Monthly take-home pay (USD)", hint: "After taxes and payroll deductions", step: "0.01" },
  { key: "monthlySpending", label: "Monthly spending, excluding loan payments (USD)", hint: "Rent, food, transport and everything else", step: "0.01" },
  { key: "monthlyLoanPayments", label: "Existing required loan payments (USD)", hint: "Counted once, as debt and as spending", step: "0.01" },
  { key: "savings", label: "Cash savings (USD)", hint: "Money you could reach in an emergency", step: "0.01" },
  { key: "aprPercent", label: "Offered APR (%)", hint: "From 0 to 100", step: "0.01" },
  { key: "termMonths", label: "Loan term (months)", hint: "Whole months from 12 to 96", step: "1" },
  { key: "grossMonthly", label: "Gross monthly income (USD, optional)", hint: "Leave blank to estimate it from take-home pay", step: "0.01" },
];
const initial = Object.fromEntries(controls.map(({ key }) => [key, key === "grossMonthly" ? "" : String(loanDefaults[key])])) as Record<Field, string>;
const usd = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
const months = (value: number | null) => value === null ? "No modeled limit" : `${value} months`;

function Scenario({ scenario }: { scenario: NonNullable<LoanComfortResult["scenarios"]>["lender"] }) {
  return <div className="decision-summary-card"><h3>{scenario.label}</h3><strong>{usd(scenario.principalCents)}</strong><p>{usd(scenario.paymentCents)} a month · {scenario.paymentShareOfTakeHome}% of take-home</p><ul>
    <li>Total interest over the term: {usd(scenario.totalInterestCents)}</li>
    <li>Monthly surplus after the payment: {usd(scenario.monthlySurplusAfterPaymentCents)}</li>
    <li>Savings runway if income stopped: {months(scenario.jobLossRunwayMonths)}</li>
    <li>If the APR were {scenario.rateUp.points} points higher: {usd(scenario.rateUp.paymentCents)} a month (+{usd(scenario.rateUp.extraPerMonthCents)})</li>
  </ul></div>;
}

export function LoanComfortView() {
  const [fields, setFields] = useState(initial);
  const errors: Partial<Record<Field, string>> = {};
  for (const { key } of controls) {
    const raw = fields[key].trim();
    if (key === "grossMonthly" && !raw) continue;
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value < 0) errors[key] = "Enter a non-negative number.";
    else if (key === "termMonths" && (!Number.isInteger(value) || value < 12 || value > 96)) errors[key] = "Use a whole number from 12 to 96.";
    else if (key === "aprPercent" && value > 100) errors[key] = "Use an APR from 0 to 100.";
    else if ((key === "monthlyTakeHome" || key === "grossMonthly") && value <= 0) errors[key] = "Use an amount greater than zero.";
  }
  let result: LoanComfortResult | null = null;
  let calculationError = "";
  if (Object.keys(errors).length === 0) {
    try { result = createLoanComparison({ ...Object.fromEntries(controls.filter(({ key }) => key !== "grossMonthly").map(({ key }) => [key, Number(fields[key])])), grossMonthly: fields.grossMonthly.trim() ? Number(fields.grossMonthly) : undefined }); }
    catch (cause) { calculationError = cause instanceof Error ? cause.message : "The comparison could not be calculated. Check the sample inputs."; }
  }

  return <div className="tool-view">
    <header className="view-header"><div><p className="eyebrow">LOAN COMFORT / APPROVAL VS. COMFORT</p><h1>What a lender approves.<br /><span className="serif-word">What your month allows.</span></h1></div><div className="view-header__aside"><span className="tag">MERGED ENGINE / SAMPLE INPUTS</span><p>Two borrowing limits from the same numbers: an illustrative lender ceiling, and the amount your actual spending leaves room for.</p></div></header>
    <p className="inline-notice">Local educational illustration. No lender is contacted, no credit is checked and nothing is applied for. Your entries become three identical modeled months, not bank history.</p>
    <div className="tool-layout">
      <section className="panel tool-controls" aria-labelledby="loan-inputs-heading"><div className="section-heading"><div><p className="eyebrow">YOUR MONTH. ONE OFFER.</p><h2 id="loan-inputs-heading">Set your assumptions.</h2></div><span className="tag">SAMPLE / USD</span></div>
        {controls.map((control) => <div className="field" key={control.key}><label htmlFor={`loan-${control.key}`}>{control.label}</label><input id={`loan-${control.key}`} type="number" min="0" step={control.step} value={fields[control.key]} aria-invalid={!!errors[control.key]} aria-describedby={`loan-${control.key}-hint${errors[control.key] ? ` loan-${control.key}-error` : ""}`} onChange={(event) => setFields((previous) => ({ ...previous, [control.key]: event.target.value }))} /><p id={`loan-${control.key}-hint`} className="field-hint">{control.hint}</p>{errors[control.key] && <p id={`loan-${control.key}-error`} className="form-error" role="alert">{errors[control.key]}</p>}</div>)}
        <button className="button button--ghost" type="button" onClick={() => setFields(initial)}>Reset loan example <Icon name="refresh" size={15} /></button>
      </section>
      <section className="panel tool-results" aria-labelledby="loan-results-heading"><div className="section-heading"><div><p className="eyebrow">APPROVAL, SIDE BY SIDE WITH COMFORT</p><h2 id="loan-results-heading">Two limits. One decision.</h2></div><span className="tag">LOCAL CALCULATION</span></div>
        {Object.keys(errors).length > 0 ? <div className="inline-notice" role="status"><strong>Check the sample inputs.</strong><p>Results are hidden while an input is invalid.</p></div> : calculationError ? <p className="form-error" role="alert">{calculationError}</p> : result && <>
          <div className="tool-message" role="status" aria-live="polite"><p className="eyebrow">{result.message}</p><h3>{result.headline}</h3><p>A planning estimate, not a lender decision or a recommendation to borrow.</p></div>
          <div className="tool-metrics"><div><span className="eyebrow">MONTHLY SURPLUS</span><strong>{usd(result.cashFlow.surplusCents)}</strong></div><div><span className="eyebrow">CURRENT SAVINGS RUNWAY</span><strong>{months(result.cashFlow.currentRunwayMonths)}</strong></div></div>
          {result.scenarios ? <><div className="decision-summary"><Scenario scenario={result.scenarios.lender} /><Scenario scenario={result.scenarios.comfortable} /></div>{result.gapCents > 0 && <p className="inline-notice">The lender ceiling is {usd(result.gapCents)} above what fits your spending. Approval alone does not mean a payment is comfortable.</p>}</> : <div className="empty-state"><Icon name="shield" size={28} /><h3>{result.status === "not_yet" ? "A new payment can wait." : "A little more context first."}</h3>{result.reasons.map((reason) => <p key={reason}>{reason}</p>)}</div>}
          {result.assumptions.length > 0 && <details className="assumptions"><summary>Assumptions <Icon name="plus" size={16} /></summary><div><ul>{result.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></div></details>}
          <details className="assumptions"><summary>Sources <Icon name="plus" size={16} /></summary><div>{result.sources.map((source) => <p key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> — {source.note} Reviewed {source.reviewed}.</p>)}</div></details>
        </>}
      </section>
    </div>
    <div className="quiz-actions"><Link className="button button--secondary" href="/before-you-commit?tab=card">Check card readiness <Icon name="arrow-right" size={16} /></Link><Link className="button button--ghost" href="/advisor">Back to the Advisor <Icon name="arrow-up-right" size={16} /></Link></div>
  </div>;
}
