"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { createPurchasePreview, getPurchaseSignals, purchaseDemo, type PurchasePreviewResult } from "../api/purchase";
import { Icon } from "../components/icon";

type AmountField = "purchaseAmount" | "currentSavings" | "targetSavings" | "monthlyContribution";
type Drafts = Record<AmountField | "label" | "horizonMonths", string>;
const initial: Drafts = { label: "TV", purchaseAmount: "1200", currentSavings: "3000", targetSavings: "6000", monthlyContribution: "600", horizonMonths: "120" };
const amountControls: { key: AmountField; label: string; hint: string }[] = [
  { key: "purchaseAmount", label: "Purchase price (USD)", hint: "One immediate cash purchase" },
  { key: "currentSavings", label: "Current goal savings (USD)", hint: "Use the selected balance timing" },
  { key: "targetSavings", label: "Savings goal (USD)", hint: "Your explicit target, greater than zero" },
  { key: "monthlyContribution", label: "Monthly contribution (USD)", hint: "The same month-end contribution in both paths" },
];
const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const milestone = (month: number | null) => month === null ? "Beyond projection" : month === 0 ? "Goal met now" : `Month ${month}`;

function PurchaseProjection({ result }: { result: PurchasePreviewResult }) {
  const chartId = useId();
  const [showAllMonths, setShowAllMonths] = useState(false);
  const chartEnd = Math.min(result.horizonMonths, Math.max(12, result.baselineMonths ?? result.horizonMonths, result.purchaseMonths ?? result.horizonMonths));
  const rows = result.baseline.points.slice(0, chartEnd + 1).map((point, index) => ({ month: point.month, without: point.cash, with: result.purchased.points[index].cash }));
  const low = Math.min(0, ...rows.map((row) => row.with));
  const high = Math.max(1, result.targetSavings, ...rows.map((row) => row.without));
  const left = 76;
  const right = 734;
  const top = 30;
  const bottom = 270;
  const x = (month: number) => left + (month / chartEnd) * (right - left);
  const y = (cash: number) => bottom - ((cash - low) / (high - low)) * (bottom - top);
  const line = (key: "without" | "with") => rows.map((row) => `${x(row.month)},${y(row[key])}`).join(" ");
  const tableRows = result.baseline.points.slice(0, showAllMonths ? undefined : 25);

  return <>
    <div className="purchase-result-message" role="status" aria-live="polite"><p className="eyebrow">THE TRADEOFF, IN MONTHS</p><h3>{result.message}</h3><p>A planning estimate, not a recommendation to buy or avoid the purchase.</p></div>
    <div className="purchase-metrics"><div><span className="eyebrow">WITHOUT PURCHASE</span><strong>{milestone(result.baselineMonths)}</strong></div><div><span className="eyebrow">WITH PURCHASE</span><strong>{milestone(result.purchaseMonths)}</strong></div><div><span className="eyebrow">PROJECTED GOAL DELAY</span><strong>{result.delayMonths === null ? "Unavailable" : `${result.delayMonths} ${result.delayMonths === 1 ? "month" : "months"}`}</strong></div><div><span className="eyebrow">CASH AFTER PURCHASE</span><strong>{usd(result.remainingAfterPurchase)}</strong></div></div>
    {result.shortfallAmount > 0 && <p className="inline-notice purchase-shortfall" role="status"><strong>Unfunded cash gap: {usd(result.shortfallAmount)}.</strong> The purchase exceeds the selected savings. A negative path shows a shortfall; this model does not supply credit or include borrowing costs.</p>}
    {(result.status === "baseline_unreached" || result.status === "purchase_unreached") && <p className="inline-notice">A goal beyond the {result.horizonMonths}-month projection has no known milestone here. The delay is unavailable; it is not zero.</p>}
    <figure className="purchase-chart"><svg viewBox="0 0 790 320" role="img" aria-labelledby={`${chartId}-title ${chartId}-description`}>
      <title id={`${chartId}-title`}>{`Savings paths across ${chartEnd} months`}</title>
      <desc id={`${chartId}-description`}>{`Without purchase: ${milestone(result.baselineMonths)}. With purchase: ${milestone(result.purchaseMonths)}. Goal ${usd(result.targetSavings)}. Exact monthly cash values are available below.`}</desc>
      {[0, 0.5, 1].map((fraction) => {
        const cash = low + (high - low) * fraction;
        return <g key={fraction} className="chart-grid"><line x1={left} y1={y(cash)} x2={right} y2={y(cash)} /><text className="chart-label" x={left - 10} y={y(cash) + 4} textAnchor="end">{usd(cash)}</text></g>;
      })}
      <line x1={left} x2={right} y1={y(result.targetSavings)} y2={y(result.targetSavings)} stroke="var(--ink)" strokeDasharray="2 6" opacity=".65" />
      <text className="chart-label" x={left + 5} y={y(result.targetSavings) - 8}>{`Goal ${usd(result.targetSavings)}`}</text>
      <polyline fill="none" points={line("without")} stroke="var(--muted)" strokeWidth="2.5" strokeDasharray="8 5" />
      <polyline fill="none" points={line("with")} stroke="var(--accent-ink)" strokeWidth="3" />
      {[0, Math.round(chartEnd / 2), chartEnd].filter((month, index, values) => values.indexOf(month) === index).map((month) => <text className="chart-label" key={month} x={x(month)} y={bottom + 27} textAnchor="middle">{month === 0 ? "Now" : `Month ${month}`}</text>)}
    </svg><figcaption>Goal-account cash · showing months 0–{chartEnd} of a {result.horizonMonths}-month projection. Every point comes from the merged simulator.</figcaption></figure>
    <div className="purchase-chart-key"><span>┄ Dashed: without purchase</span><span>━ Solid: with purchase</span><span>┈ Dotted: savings goal</span></div>
    <details className="assumptions purchase-source"><summary>Assumptions and calculation source <Icon name="plus" size={16} /></summary><div><p>The merged purchase preview runs the existing monthly simulator twice, changing only the one immediate purchase. Goal months use your stated target and include month zero.</p><ul>{result.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul><p>This illustration does not determine whether buying is appropriate or affordable. A card-funded or financed purchase requires a separate debt scenario.</p></div></details>
    <details className="assumptions"><summary>See exact monthly savings <Icon name="plus" size={16} /></summary><div><div className="table-scroll"><table className="comparison-table"><caption>Goal savings in USD · {showAllMonths || result.horizonMonths <= 24 ? "all projection months" : `first 24 of ${result.horizonMonths} months`}</caption><thead><tr><th scope="col">Month</th><th scope="col">Without purchase</th><th scope="col">With purchase</th></tr></thead><tbody>{tableRows.map((point) => <tr key={point.month}><th scope="row">{point.month}</th><td>{usd(point.cash)}</td><td>{usd(result.purchased.points[point.month].cash)}</td></tr>)}</tbody></table></div>{result.horizonMonths > 24 && <div className="purchase-table-controls"><button className="button button--ghost" type="button" onClick={() => setShowAllMonths(!showAllMonths)}>{showAllMonths ? "Show the first 24 months" : "Show all projection months"}</button></div>}</div></details>
  </>;
}

export function PurchaseImpactView() {
  const [fields, setFields] = useState(initial);
  const [timing, setTiming] = useState<"planned" | "posted">("planned");
  const [fundingConfirmed, setFundingConfirmed] = useState(false);
  const [timingConfirmed, setTimingConfirmed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const signal = getPurchaseSignals()[0];
  const errors: Partial<Record<keyof Drafts, string>> = {};
  if (!fields.label.trim() || fields.label.trim().length > 80) errors.label = "Use a purchase label between 1 and 80 characters.";
  for (const control of amountControls) {
    const raw = fields[control.key];
    const value = Number(raw);
    if (!raw.trim() || !Number.isFinite(value) || value < 0 || value > 1e9 || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001 || (control.key === "targetSavings" && value <= 0)) errors[control.key] = `Use ${control.key === "targetSavings" ? "a positive" : "a non-negative"} USD amount up to $1 billion, with at most two decimal places.`;
  }
  const horizon = Number(fields.horizonMonths);
  if (!fields.horizonMonths.trim() || !Number.isInteger(horizon) || horizon < 1 || horizon > 1200) errors.horizonMonths = "Use a whole number from 1 to 1,200 months.";
  const valid = Object.keys(errors).length === 0;
  let result: PurchasePreviewResult | null = null;
  let calculationError = "";
  if (valid && confirmed) {
    try { result = createPurchasePreview({ label: fields.label, timing, purchaseAmount: Number(fields.purchaseAmount), currentSavings: Number(fields.currentSavings), targetSavings: Number(fields.targetSavings), monthlyContribution: Number(fields.monthlyContribution), horizonMonths: horizon }); }
    catch (cause) { calculationError = cause instanceof Error ? cause.message : "The projection could not be calculated. Check the sample inputs."; }
  }

  function resetConfirmation() { setConfirmed(false); setFundingConfirmed(false); setTimingConfirmed(false); }
  function reset() { setFields(initial); setTiming("planned"); resetConfirmation(); }
  function loadDetected() {
    setFields({ ...initial, label: "purchase at Demo Electronics", currentSavings: "1800" });
    setTiming("posted");
    resetConfirmation();
  }

  return <div className="purchase-view">
    <header className="view-header"><div><p className="eyebrow">PURCHASE IMPACT / A CLEARER TRADEOFF</p><h1>See the tradeoff.<br /><span className="serif-word">Keep the choice.</span></h1></div><div className="view-header__aside"><span className="tag">MERGED SIMULATOR / SAMPLE INPUTS</span><p>A purchase and a savings goal, side by side. Explore what changes before deciding what works for you.</p></div></header>
    <p className="inline-notice">Local educational illustration. No bank is connected and no money moves. Monthly projections cannot predict an exact day or week.</p>
    {signal && <section className="panel purchase-signal" aria-labelledby="purchase-signal-heading"><div><p className="eyebrow">SYNTHETIC ACTIVITY / {purchaseDemo.asOf}</p><h2 id="purchase-signal-heading">A purchase worth a closer look.</h2><p>{signal.message}</p><p className="caption">{signal.evidence}</p><p className="field-hint">The detector does not know which account paid. The sample preset uses a balance after the purchase; confirm its funding and timing below.</p></div><button className="button button--secondary" type="button" onClick={loadDetected}>Review detected sample purchase <Icon name="arrow-up-right" size={16} /></button></section>}
    <div className="purchase-layout">
      <section className="panel purchase-controls" aria-labelledby="purchase-inputs-heading"><div className="section-heading"><div><p className="eyebrow">ONE PURCHASE. ONE GOAL.</p><h2 id="purchase-inputs-heading">Set your assumptions.</h2></div><span className="tag">SAMPLE / USD</span></div>
        <div className="field"><label htmlFor="purchase-label">Purchase label</label><input id="purchase-label" value={fields.label} maxLength={80} aria-invalid={!!errors.label} aria-describedby={errors.label ? "purchase-label-error" : undefined} onChange={(event) => setFields((previous) => ({ ...previous, label: event.target.value }))} />{errors.label && <p id="purchase-label-error" className="form-error" role="alert">{errors.label}</p>}</div>
        <div className="field"><label htmlFor="purchase-timing">Balance timing</label><select id="purchase-timing" value={timing} onChange={(event) => { setTiming(event.target.value as "planned" | "posted"); resetConfirmation(); }}><option value="planned">Before purchase — planned</option><option value="posted">After purchase — already deducted</option></select><p className="field-hint">{timing === "posted" ? "Enter savings after this purchase was deducted. The comparison adds it back once to model the path without purchase." : "Enter savings before this purchase. The purchase is subtracted once from the with-purchase path."}</p></div>
        {amountControls.map((control) => <div className="field" key={control.key}><label htmlFor={`purchase-${control.key}`}>{control.label}</label><input id={`purchase-${control.key}`} type="number" min={control.key === "targetSavings" ? "0.01" : "0"} max="1000000000" step="0.01" value={fields[control.key]} aria-invalid={!!errors[control.key]} aria-describedby={`purchase-${control.key}-hint${errors[control.key] ? ` purchase-${control.key}-error` : ""}`} onChange={(event) => setFields((previous) => ({ ...previous, [control.key]: event.target.value }))} /><p id={`purchase-${control.key}-hint`} className="field-hint">{control.hint}</p>{errors[control.key] && <p id={`purchase-${control.key}-error`} className="form-error" role="alert">{errors[control.key]}</p>}</div>)}
        <div className="field"><label htmlFor="purchase-horizon">Projection horizon (months)</label><input id="purchase-horizon" type="number" min="1" max="1200" step="1" value={fields.horizonMonths} aria-invalid={!!errors.horizonMonths} aria-describedby={errors.horizonMonths ? "purchase-horizon-error" : undefined} onChange={(event) => setFields((previous) => ({ ...previous, horizonMonths: event.target.value }))} />{errors.horizonMonths && <p id="purchase-horizon-error" className="form-error" role="alert">{errors.horizonMonths}</p>}</div><button className="button button--ghost" type="button" onClick={reset}>Reset purchase example <Icon name="refresh" size={15} /></button>
      </section>
      <div>
        <section className="panel purchase-confirmation" aria-labelledby="purchase-confirm-heading"><p className="eyebrow">BEFORE THE NUMBERS</p><h2 id="purchase-confirm-heading">Confirm what the balance means.</h2>{confirmed ? <><p><Icon name="check" size={16} /> Sample funding and balance timing confirmed. Valid input edits recalculate this illustration.</p><button className="button button--ghost" type="button" onClick={resetConfirmation}>Review sample confirmation</button></> : <><p>This preview assumes an immediate cash purchase from the savings account shown. A credit-card or financed purchase needs a different scenario.</p><label className="consent-checkbox"><input type="checkbox" checked={fundingConfirmed} onChange={(event) => setFundingConfirmed(event.target.checked)} /><span>I confirm this sample purchase is funded from the goal savings account.</span></label><label className="consent-checkbox"><input type="checkbox" checked={timingConfirmed} onChange={(event) => setTimingConfirmed(event.target.checked)} /><span>{timing === "posted" ? "I confirm this balance already includes the purchase." : "I confirm this balance is before the purchase."}</span></label><button className="button button--primary" type="button" disabled={!fundingConfirmed || !timingConfirmed || !valid} onClick={() => setConfirmed(true)}>Confirm sample assumptions <Icon name="check" size={16} /></button></>}</section>
        <section className="panel purchase-results" aria-labelledby="purchase-results-heading"><div className="section-heading"><div><p className="eyebrow">YOUR GOAL, SIDE BY SIDE</p><h2 id="purchase-results-heading">Two paths. A clearer picture.</h2></div><span className="tag">LOCAL CALCULATION</span></div>{!confirmed ? <div className="empty-state purchase-empty"><Icon name="shield" size={28} /><h3>Funding first. Forecast second.</h3><p>Confirm the sample account and whether the entered balance is before or after the purchase to open the comparison.</p></div> : !valid ? <div className="inline-notice" role="status"><strong>Check the sample inputs.</strong><p>The previous projection is hidden while an input is invalid. Correct the marked field to calculate a new comparison.</p></div> : calculationError ? <p className="form-error" role="alert">{calculationError}</p> : result && <PurchaseProjection result={result} />}</section>
      </div>
    </div>
    <div className="quiz-actions"><Link className="button button--secondary" href="/future-lab">Explore Future Lab <Icon name="arrow-right" size={16} /></Link><Link className="button button--ghost" href="/advisor">Back to the Advisor <Icon name="arrow-up-right" size={16} /></Link></div>
  </div>;
}
