"use client";

import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { decisionTableRows, getDecisionResult, type Block, type ChartMetric, type DecisionResult, type Session, type TableRowKey } from "../api/decisions";
import { currency } from "../lib/finance";

export const decisionMetricLabels: Record<ChartMetric, string> = { netWorth: "Net worth", cash: "Cash", debt: "Debt" };

function axisMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function DecisionChart({ result, metric, title }: { result: DecisionResult; metric: ChartMetric; title?: string }) {
  const chartId = useId();
  const { comparison, months } = result;
  const projections = [comparison.a, comparison.b];
  const values = projections.flatMap((projection) => projection.points.map((point) => point[metric]));
  const low = Math.min(0, ...values);
  const high = Math.max(1000, ...values);
  const padding = (high - low) * 0.07;
  const chartLow = low - (low < 0 ? padding : 0);
  const chartHigh = high + padding;
  const left = 76, right = 720, top = 24, bottom = 264;
  const x = (month: number) => left + month / months * (right - left);
  const y = (value: number) => bottom - (value - chartLow) / (chartHigh - chartLow) * (bottom - top);
  const ticks = Array.from({ length: 5 }, (_, index) => chartLow + (chartHigh - chartLow) * index / 4);
  const heading = title ?? `${decisionMetricLabels[metric]} over ${result.snapshot.years} years`;
  const [hover, setHover] = useState<number | null>(null);
  const monthAt = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const viewX = (event.clientX - box.left) / box.width * 760;
    return Math.min(months, Math.max(0, Math.round((viewX - left) / (right - left) * months)));
  };
  const step = (event: KeyboardEvent<SVGSVGElement>) => {
    const delta = { ArrowRight: 1, ArrowLeft: -1, PageUp: 12, PageDown: -12 }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    setHover((month) => Math.min(months, Math.max(0, (month ?? 0) + delta)));
  };
  const tipX = hover !== null && x(hover) > right - 230 ? x(hover) - 222 : x(hover ?? 0) + 12;
  return <figure className="path-chart decision-chart">
    <p className="decision-chart-heading" aria-hidden="true">{heading}</p>
    <svg viewBox="0 0 760 320" role="img" aria-labelledby={`${chartId}-title ${chartId}-description`} tabIndex={0} onPointerMove={(event) => setHover(monthAt(event))} onPointerLeave={() => setHover(null)} onKeyDown={step} onBlur={() => setHover(null)}>
      <title id={`${chartId}-title`}>{heading}</title>
      <desc id={`${chartId}-description`}>{`${comparison.a.label} is the solid line; ${comparison.b.label} is dashed. End values are ${currency(comparison.a.points[months][metric])} and ${currency(comparison.b.points[months][metric])}. Tables below provide the values.`}</desc>
      {ticks.map((tick, index) => <g className="chart-grid" key={index}><line x1={left} x2={right} y1={y(tick)} y2={y(tick)} /><text className="chart-label" x={left - 12} y={y(tick) + 4} textAnchor="end">{axisMoney(tick)}</text></g>)}
      {chartLow < 0 && <line className="chart-zero" x1={left} x2={right} y1={y(0)} y2={y(0)} stroke="currentColor" />}
      {[0, months / 2, months].map((month) => <text className="chart-label" key={month} x={x(month)} y={bottom + 27} textAnchor="middle">{month === 0 ? "Today" : `${month / 12} yr`}</text>)}
      {projections.map((projection, index) => <g key={index}><polyline fill="none" points={projection.points.map((point) => `${x(point.month)},${y(point[metric])}`).join(" ")} stroke={index === 0 ? "var(--ink)" : "var(--accent-ink)"} strokeWidth="3" strokeDasharray={index === 0 ? undefined : "9 5"} /><circle cx={x(months)} cy={y(projection.points[months][metric])} r="4.5" fill={index === 0 ? "var(--ink)" : "var(--accent-ink)"} /></g>)}
      {hover !== null && <g className="chart-hover" aria-hidden="true">
        <line x1={x(hover)} x2={x(hover)} y1={top} y2={bottom} />
        {projections.map((projection, index) => <circle key={index} cx={x(hover)} cy={y(projection.points[hover][metric])} r="5" fill={index === 0 ? "var(--ink)" : "var(--accent-ink)"} stroke="var(--surface)" strokeWidth="2" />)}
        <rect x={tipX} y={top} width="210" height="62" />
        <text x={tipX + 10} y={top + 18} className="chart-tip-title">{hover === 0 ? "Today" : `Month ${hover}${hover % 12 === 0 ? ` (${hover / 12} yr)` : ""}`}</text>
        {projections.map((projection, index) => <text key={index} x={tipX + 10} y={top + 36 + index * 17}>{index === 0 ? "A" : "B"} · {projection.label.slice(0, 18)}: {currency(projection.points[hover][metric])}</text>)}
      </g>}
    </svg>
    <figcaption>{decisionMetricLabels[metric]} · USD · estimated monthly projection. Negative cash is an unfunded gap. Hover, or focus and use the arrow keys, to read any month.</figcaption>
    <div className="decision-legend"><span><i aria-hidden="true" />A / solid · {comparison.a.label}</span><span><i aria-hidden="true" />B / dashed · {comparison.b.label}</span></div>
  </figure>;
}

/** Month-1 budget for both options: one row per category, A and B bars side by side on a shared scale. */
export function DecisionBreakdown({ result }: { result: DecisionResult }) {
  const rows = result.budget;
  const values = rows.flatMap((row) => [row.a, row.b]);
  const low = Math.min(0, ...values);
  const high = Math.max(1, ...values);
  const at = (value: number) => (value - low) / (high - low) * 100;
  const zero = at(0);
  const sides = [{ key: "a", label: result.comparison.a.label }, { key: "b", label: result.comparison.b.label }] as const;
  return <figure className="decision-breakdown">
    <figcaption><strong>Where the money goes each month</strong><span>First month · USD · costs that differ between the options stand out side by side</span></figcaption>
    <div className="decision-legend">{sides.map((side) => <span key={side.key}><i className={`breakdown-swatch is-${side.key}`} aria-hidden="true" />{side.key.toUpperCase()} · {side.label}</span>)}</div>
    <div className="breakdown-rows" role="table" aria-label="Monthly budget by category">
      <div role="row" className="sr-only"><span role="columnheader">Category</span>{sides.map((side) => <span role="columnheader" key={side.key}>{side.label}</span>)}</div>
      {rows.map((row) => <div className={`breakdown-row is-${row.kind}`} role="row" key={row.label}>
        <span className="breakdown-label" role="rowheader">{row.label}</span>
        {sides.map((side) => {
          const value = row[side.key];
          return <span className="breakdown-line" role="cell" key={side.key} title={`${side.label} · ${row.label}: ${currency(value)} / mo`}>
            <span className="breakdown-track"><span className="breakdown-zero" style={{ left: `${zero}%` }} /><span className={`breakdown-bar is-${side.key}${value < 0 ? " is-negative" : ""}`} style={{ left: `${value < 0 ? at(value) : zero}%`, width: `${Math.abs(at(value) - zero)}%` }} /></span>
            <span className="breakdown-value">{value < 0 && <span className="decision-risk-marker">Short </span>}{currency(value)}</span>
          </span>;
        })}
      </div>)}
    </div>
  </figure>;
}

export function DecisionTable({ result, rows, caption = "Comparison from the merged scenario engine" }: { result: DecisionResult; rows?: TableRowKey[]; caption?: string }) {
  const chosen = decisionTableRows(result.months, rows);
  return <div className="table-scroll"><table className="comparison-table decision-comparison-table"><caption>{caption}</caption><thead><tr><th scope="col">Measure</th><th scope="col">{result.comparison.a.label}</th><th scope="col">{result.comparison.b.label}</th></tr></thead><tbody>{chosen.map(({ key, row }) => <tr key={key}><th scope="row">{row.label(result.months)}</th>{[result.comparison.a, result.comparison.b].map((projection, index) => <td key={index}>{row.bad?.(projection) && <span className="decision-risk-marker">Review: </span>}{row.value(projection, result.months)}</td>)}</tr>)}</tbody></table></div>;
}

export function DecisionSummary({ result, metric = "netWorth" }: { result: DecisionResult; metric?: ChartMetric }) {
  return <div className="decision-summary">{[result.comparison.a, result.comparison.b].map((projection, index) => <article className="decision-summary-card" key={index}><p className="eyebrow">{index === 0 ? "A / SOLID LINE" : "B / DASHED LINE"}</p><h3>{projection.label}</h3><span>{decisionMetricLabels[metric]} after {result.snapshot.years} {result.snapshot.years === 1 ? "year" : "years"}</span><strong>{currency(projection.points[result.months][metric])}</strong><small>{projection.shortfallMonth === null ? "No cash shortfall in this projection" : `Cash shortfall starts in month ${projection.shortfallMonth}`}</small></article>)}</div>;
}

export function DecisionBlock({ block, interactive, onChoose, onLoadSnapshot, showLabel = true }: { block: Block; interactive: boolean; onChoose: (choice: string) => void; onLoadSnapshot: (snapshot: Session) => void; showLabel?: boolean }) {
  const archived = useMemo(() => {
    if (!("snapshot" in block)) return null;
    try { return { result: getDecisionResult(block.snapshot), error: "" }; }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : "This saved comparison is unavailable." }; }
  }, [block]);
  if (block.type === "question") return <div className="decision-block decision-block--question"><p>{block.text}</p><div className="decision-question-choices">{block.choices.map((choice, index) => <button className="button button--secondary" type="button" key={index} disabled={!interactive} onClick={() => onChoose(choice)}>{choice}</button>)}</div>{!interactive && <p className="field-hint">An earlier question in this conversation.</p>}</div>;
  if (block.type === "message") return <div className="decision-block decision-block--message"><p className="eyebrow">FROM THE CALCULATED RESULTS</p>{block.lines.map((line, index) => <p key={index}>{line}</p>)}</div>;
  if (!archived?.result) return <p className="form-error" role="alert">{archived?.error ?? "This comparison could not be displayed."}</p>;
  const result = archived.result;
  return <div className={`decision-block decision-block--${block.type}`}>{showLabel && <div className="decision-snapshot-label"><span className="tag">FROZEN COMPARISON</span><span>{result.scenario.title} · {result.snapshot.years} years</span></div>}
    {block.type === "chart" && <DecisionChart result={result} metric={block.metric} title={block.title} />}
    {block.type === "table" && <DecisionTable result={result} rows={block.rows} caption="Values at the time of this reply" />}
    {block.type === "breakdown" && <DecisionBreakdown result={result} />}
    {block.type === "playground" && <><DecisionSummary result={result} /><p>These values capture the assumptions at this point in the conversation. Later edits leave this comparison intact.</p><button className="button button--secondary" type="button" onClick={() => onLoadSnapshot({ scenarioId: result.snapshot.scenarioId, values: { ...result.snapshot.values }, years: result.snapshot.years })}>Edit this comparison above</button></>}
  </div>;
}
