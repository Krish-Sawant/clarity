"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { createStressTest, shockDefaults, stressDefaults, STRESS_LABELS, type StressEvent, type StressResult } from "../api/stress";
import { Icon } from "../components/icon";

type StartField = keyof typeof stressDefaults;
type ShockField = "label" | "incomeChange" | "expenseChange" | "oneTimeCost" | "startMonth" | "durationMonths";
const startControls: { key: StartField; label: string; step: string }[] = [
  { key: "savings", label: "Available cash savings (USD)", step: "0.01" },
  { key: "monthlyIncome", label: "Monthly take-home income (USD)", step: "0.01" },
  { key: "monthlyExpenses", label: "Total monthly expenses (USD)", step: "0.01" },
  { key: "monthlyRent", label: "Rent already included in expenses (USD)", step: "0.01" },
  { key: "horizonMonths", label: "Projection length (months)", step: "1" },
];
const shockControls: { key: Exclude<ShockField, "label">; label: string; step: string }[] = [
  { key: "incomeChange", label: "Monthly income change (USD, negative for less)", step: "0.01" },
  { key: "expenseChange", label: "Monthly expense change (USD, negative for less)", step: "0.01" },
  { key: "oneTimeCost", label: "One-time cost (USD)", step: "0.01" },
  { key: "startMonth", label: "Starts in month", step: "1" },
  { key: "durationMonths", label: "Lasts how many months?", step: "1" },
];
const toDrafts = <T extends object>(values: T) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) as Record<keyof T, string>;
const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

function StressProjection({ result, label }: { result: StressResult; label: string }) {
  const chartId = useId();
  const all = [...result.baseline, ...result.stressed].map((point) => point.cash);
  const low = Math.min(0, ...all);
  const high = Math.max(1, ...all);
  const left = 76, right = 734, top = 30, bottom = 270;
  const x = (month: number) => left + (month / result.horizon) * (right - left);
  const y = (cash: number) => bottom - ((cash - low) / (high - low)) * (bottom - top);
  const line = (points: StressResult["baseline"]) => points.map((point) => `${x(point.month)},${y(point.cash)}`).join(" ");
  const end = result.stressed.at(-1)!.cash;

  return <>
    <div className="tool-message" role="status" aria-live="polite"><p className="eyebrow">{label}</p><h3>{result.message}</h3><p>A scenario, not a probability or a prediction.</p></div>
    <div className="tool-metrics"><div><span className="eyebrow">MONTHLY NET AFTER SHOCK</span><strong>{usd(result.monthlyNet)}</strong></div><div><span className="eyebrow">CASH AT MONTH {result.horizon}</span><strong>{usd(end)}</strong></div><div><span className="eyebrow">WITHOUT THE SHOCK</span><strong>{usd(result.baseline.at(-1)!.cash)}</strong></div><div><span className="eyebrow">BREAK-EVEN EXTRA SAVINGS</span><strong>{usd(result.minimumExtraSavings)}</strong></div></div>
    <figure className="tool-chart"><svg viewBox="0 0 790 320" role="img" aria-labelledby={`${chartId}-title ${chartId}-description`}>
      <title id={`${chartId}-title`}>{`Projected cash over ${result.horizon} months`}</title>
      <desc id={`${chartId}-description`}>{`${result.message} The dashed line shows no shock. The solid line shows ${label}. Exact amounts are in the table below.`}</desc>
      {[0, 0.5, 1].map((fraction) => {
        const cash = low + (high - low) * fraction;
        return <g key={fraction} className="chart-grid"><line x1={left} y1={y(cash)} x2={right} y2={y(cash)} /><text className="chart-label" x={left - 10} y={y(cash) + 4} textAnchor="end">{usd(Math.round(cash))}</text></g>;
      })}
      {low < 0 && <line x1={left} x2={right} y1={y(0)} y2={y(0)} stroke="var(--ink)" strokeDasharray="2 6" opacity=".65" />}
      <polyline fill="none" points={line(result.baseline)} stroke="var(--muted)" strokeWidth="2.5" strokeDasharray="8 5" />
      <polyline fill="none" points={line(result.stressed)} stroke="var(--accent-ink)" strokeWidth="3" />
      {[0, Math.round(result.horizon / 2), result.horizon].filter((month, index, values) => values.indexOf(month) === index).map((month) => <text className="chart-label" key={month} x={x(month)} y={bottom + 27} textAnchor="middle">{month === 0 ? "Now" : `Month ${month}`}</text>)}
    </svg><figcaption>Projected cash from the merged simulator. Below zero means an unmet funding need, not spendable savings.</figcaption></figure>
    <div className="tool-chart-key"><span>┄ Dashed: no shock</span><span>━ Solid: selected scenario</span>{low < 0 && <span>┈ Dotted: zero cash</span>}</div>
    {result.preparation.length > 0 && <><h3>Prepare now</h3><ul>{result.preparation.map((step) => <li key={step}>{step}</li>)}</ul></>}
    <details className="assumptions"><summary>See exact monthly values <Icon name="plus" size={16} /></summary><div><div className="table-scroll"><table className="comparison-table"><caption>Projected cash in USD</caption><thead><tr><th scope="col">Month</th><th scope="col">No shock</th><th scope="col">Selected scenario</th></tr></thead><tbody>{result.stressed.map((point, index) => <tr key={point.month}><th scope="row">{point.month}</th><td>{usd(result.baseline[index].cash)}</td><td>{usd(point.cash)}</td></tr>)}</tbody></table></div></div></details>
    <details className="assumptions"><summary>Why you can trust these numbers <Icon name="plus" size={16} /></summary><div><p>Both timelines use Clarity’s shared simulation engine and the inputs shown here. No AI generates these numbers.</p><ul>{result.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></div></details>
  </>;
}

export function StressTestView({ embedded = false }: { embedded?: boolean }) {
  const [start, setStart] = useState(() => toDrafts(stressDefaults));
  const [shock, setShock] = useState(() => toDrafts(shockDefaults));
  const [event, setEvent] = useState<StressEvent | "custom">("job-loss");
  const blank = Object.values(start).some((value) => !value.trim()) || (event === "custom" && Object.values(shock).some((value) => !value.trim()));
  let result: StressResult | null = null;
  let error = "";
  if (blank) error = "Complete every field to see a projection.";
  else {
    const input = Object.fromEntries(Object.entries(start).map(([key, value]) => [key, Number(value)]));
    try {
      result = createStressTest(event === "custom"
        ? { ...input, shock: { ...Object.fromEntries(shockControls.map(({ key }) => [key, Number(shock[key])])), label: shock.label } }
        : { ...input, event });
    } catch (cause) { error = cause instanceof Error ? cause.message : "Check the sample inputs."; }
  }
  const label = event === "custom" ? shock.label.trim() || "Your own situation" : STRESS_LABELS[event];

  const Heading = embedded ? "h2" : "h1";

  return <div className={`tool-view${embedded ? " is-embedded" : ""}`} id={embedded ? "stress-test" : undefined}>
    <header className="view-header"><div><p className="eyebrow">STRESS TEST / ONE SHOCK AT A TIME</p><Heading>What if something goes wrong?<br /><span className="serif-word">See it before it happens.</span></Heading></div><div className="view-header__aside"><span className="tag">MERGED SIMULATOR / SAMPLE INPUTS</span><p>Compare your current path with one setback at a time, month by month.</p></div></header>
    <p className="inline-notice">Local educational illustration. No bank is connected and no money moves. Monthly netting cannot detect an overdraft between paydays.</p>
    <div className="tool-choices" role="group" aria-label="Choose a stress scenario">{(Object.keys(STRESS_LABELS) as StressEvent[]).map((key) => <button key={key} type="button" className="button button--secondary" aria-pressed={event === key} onClick={() => setEvent(key)}>{STRESS_LABELS[key]}</button>)}<button type="button" className="button button--secondary" aria-pressed={event === "custom"} onClick={() => setEvent("custom")}>My own situation</button></div>
    <div className="tool-layout">
      <section className="panel tool-controls" aria-labelledby="stress-inputs-heading"><div className="section-heading"><div><p className="eyebrow">YOUR STARTING POINT</p><h2 id="stress-inputs-heading">Set your assumptions.</h2></div><span className="tag">SAMPLE / USD</span></div>
        {startControls.map((control) => <div className="field" key={control.key}><label htmlFor={`stress-${control.key}`}>{control.label}</label><input id={`stress-${control.key}`} type="number" min={control.key === "horizonMonths" ? "1" : "0"} max={control.key === "horizonMonths" ? "120" : "1000000000"} step={control.step} value={start[control.key]} onChange={(changed) => setStart((previous) => ({ ...previous, [control.key]: changed.target.value }))} /></div>)}
        <p>Include rent and required debt payments once in total expenses. Use cash available before the shock.</p>
        {event === "custom" && <><div className="field"><label htmlFor="stress-label">My situation</label><input id="stress-label" maxLength={120} value={shock.label} onChange={(changed) => setShock((previous) => ({ ...previous, label: changed.target.value }))} /></div>
          {shockControls.map((control) => <div className="field" key={control.key}><label htmlFor={`stress-${control.key}`}>{control.label}</label><input id={`stress-${control.key}`} type="number" step={control.step} value={shock[control.key]} onChange={(changed) => setShock((previous) => ({ ...previous, [control.key]: changed.target.value }))} /></div>)}
          <p>Changes apply only for the duration you enter; your original income and spending then resume. Month 1 is next month.</p></>}
        <button className="button button--ghost" type="button" onClick={() => { setStart(toDrafts(stressDefaults)); setShock(toDrafts(shockDefaults)); setEvent("job-loss"); }}>Reset stress example <Icon name="refresh" size={15} /></button>
      </section>
      <section className="panel tool-results" aria-labelledby="stress-results-heading"><div className="section-heading"><div><p className="eyebrow">TWO PATHS, SIDE BY SIDE</p><h2 id="stress-results-heading">{label}</h2></div><span className="tag">LOCAL CALCULATION</span></div>
        {error ? <div className="inline-notice" role="alert"><strong>Check the sample inputs.</strong><p>{error} Results are hidden until the inputs are valid.</p></div> : result && <StressProjection result={result} label={label} />}
      </section>
    </div>
    {!embedded && <div className="quiz-actions"><Link className="button button--secondary" href="/calculators#plan-checkins">Plan check-ins <Icon name="arrow-right" size={16} /></Link><Link className="button button--ghost" href="/future-lab">Back to Future Lab <Icon name="arrow-up-right" size={16} /></Link></div>}
  </div>;
}
