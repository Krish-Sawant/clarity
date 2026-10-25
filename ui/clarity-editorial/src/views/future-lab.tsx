"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Icon } from "../components/icon";
import { currency } from "../lib/finance";
import { simulateFuturePaths } from "../api/future-lab";

import type { Horizon, SimulationInputs } from "../lib/types";
import { useDemo } from "../state/demo-store";

const controls: { key: keyof SimulationInputs; label: string; max: number; step: number; hint: string }[] = [
  { key: "income", label: "Monthly take-home income", max: 15000, step: 50, hint: "After taxes and deductions" },
  { key: "rent", label: "Monthly rent", max: 8000, step: 50, hint: "Housing cost only" },
  { key: "transportation", label: "Monthly transportation", max: 4000, step: 25, hint: "Transit, car payment, gas" },
  { key: "spending", label: "Other monthly spending", max: 8000, step: 50, hint: "Food, bills, and everything else" },
  { key: "cash", label: "Starting cash", max: 50000, step: 100, hint: "Your sample cash buffer today" },
];

const chartStyles: Record<string, { color: string; dash: string; marker: string }> = {
  baseline: { color: "var(--muted)", dash: "", marker: "Solid" },
  intentional: { color: "var(--accent-ink, #657e23)", dash: "9 5", marker: "Dashed" },
  flexible: { color: "var(--ink, #131611)", dash: "2 6", marker: "Dotted" },
};

function futureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function FutureLabView() {
  const { state, update } = useDemo();
  const router = useRouter();
  const chartId = useId();
  const [selectedId, setSelectedId] = useState("baseline");
  const [draftInputs, setDraftInputs] = useState<Partial<Record<keyof SimulationInputs, string>>>({});
  const [inputErrors, setInputErrors] = useState<Partial<Record<keyof SimulationInputs, string>>>({});

  const [custom, setCustom] = useState<Record<string, string>>({ label: "", incomeChange: "0", expenseChange: "0", oneTimeCost: "0", startMonth: "1", durationMonths: "1" });
  let scenarioError = '';
  let paths = simulateFuturePaths(state.simulation, 'none', state.horizon);
  try {
    if (Object.values(custom).some(value => !value.trim())) throw new Error('Complete each scenario field.');
    paths = simulateFuturePaths(state.simulation, "none", state.horizon, {
      label: custom.label, incomeChange: Number(custom.incomeChange), expenseChange: Number(custom.expenseChange),
      oneTimeCost: Number(custom.oneTimeCost), startMonth: Number(custom.startMonth), durationMonths: Number(custom.durationMonths),
    });
  } catch (error) { scenarioError = error instanceof Error ? error.message : 'Check your scenario.'; }
  const selected = paths.find((path) => path.id === selectedId) ?? paths[0];
  const allValues = paths.flatMap((path) => path.points.map((point) => point.cash));
  const rawMin = Math.min(0, ...allValues);
  const rawMax = Math.max(1000, ...allValues);
  const spread = rawMax - rawMin;
  const tickSize = Math.max(500, Math.ceil(spread / 4 / 500) * 500);
  const chartMin = Math.floor(rawMin / tickSize) * tickSize;
  const chartMax = Math.ceil(rawMax / tickSize) * tickSize;
  const left = 74;
  const right = 724;
  const top = 24;
  const bottom = 270;
  const x = (month: number) => left + (month / state.horizon) * (right - left);
  const y = (cash: number) => bottom - ((cash - chartMin) / (chartMax - chartMin)) * (bottom - top);
  const ticks = Array.from({ length: Math.round((chartMax - chartMin) / tickSize) + 1 }, (_, index) => chartMin + index * tickSize);
  const shock = { title: custom.label.trim() || "Your own situation" };
  const monthlyExpenses = state.simulation.rent + state.simulation.transportation + state.simulation.spending;

  function setInput(key: keyof SimulationInputs, raw: string, max: number, fromRange = false) {
    setDraftInputs((previous) => {
      const next = { ...previous };
      if (fromRange) delete next[key];
      else next[key] = raw;
      return next;
    });
    const amount = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(amount) || amount < 0 || amount > max) {
      setInputErrors((previous) => ({ ...previous, [key]: `Use a number between $0 and ${currency(max)}. The projection keeps the last valid value.` }));
      return;
    }
    setInputErrors((previous) => ({ ...previous, [key]: undefined }));
    update((previous) => ({ ...previous, simulation: { ...previous.simulation, [key]: Math.round(amount * 100) / 100 } }));
  }

  function proposeGoal() {
    const amount = Math.max(0, Math.round(selected.monthlySurplus * 100) / 100);
    if (amount <= 0 || scenarioError) return;
    const at = new Date().toISOString();
    const id = crypto.randomUUID();
    update((previous) => ({
      ...previous,
      actions: [{
        id, kind: "goal", title: `Practice saving ${currency(amount)} a month`,
        summary: `Explore ${currency(amount)} as a monthly sample contribution, equal to the ${selected.label.toLowerCase()} path’s surplus before shocks. The ${shock.title.toLowerCase()} scenario has a lowest projected cash balance of ${currency(selected.minCash)}. This is an illustration to review, not a claim that the amount is affordable. Approval only records a local demo decision.`,
        amount, dueDate: futureDate(30), status: "pending", createdAt: at,
      }, ...previous.actions],
      activity: [{ id: crypto.randomUUID(), title: "Savings goal proposed", detail: `${currency(amount)} monthly contribution · awaiting your decision · demo only`, at }, ...previous.activity],
    }));
    router.push("/approach#proposals");
  }

  return (
    <div className="future-lab-view">
      <header className="view-header">
        <div><p className="eyebrow">THE FUTURE LAB / 04</p><h1>Try a different<br /><span className="serif-word">tomorrow.</span></h1></div>
        <div className="view-header__aside"><span className="tag">LOCAL CALCULATION</span><p>A few small choices. A different trajectory. Explore three paths before you commit to one.</p></div>
      </header>

      <p className="inline-notice"><Icon name="chart" size={16} /> Synthetic example. Edit sample numbers to explore the math. These estimates are educational and do not predict returns.</p>

      <section className="shock-section" id="stress-test" aria-labelledby="shock-title">
        <div className="section-heading"><div><p className="eyebrow">CHOOSE A DIFFERENT TOMORROW</p><h2 id="shock-title">My own situation</h2></div><p>Describe what could change for you, then enter the amounts and timing.</p></div><div className="segmented-control" role="group" aria-label="Simulation time horizon">{([6, 12, 24] as Horizon[]).map((horizon) => <button key={horizon} type="button" aria-pressed={state.horizon === horizon} onClick={() => update((previous) => ({ ...previous, horizon }))}>{horizon} mo</button>)}</div>
        <div className="panel tool-controls"><div className="section-heading"><h3>Describe the change</h3><span className="tag">ONE SCENARIO</span></div><div className="field"><label htmlFor="lab-scenario-label">My situation</label><input id="lab-scenario-label" placeholder="What are you planning or concerned about?" maxLength={120} value={custom.label} onChange={e => setCustom(previous => ({ ...previous, label: e.target.value }))} /></div>{([{key:'incomeChange',label:'Monthly income change (USD, negative for less)'},{key:'expenseChange',label:'Monthly expense change (USD, negative for less)'},{key:'oneTimeCost',label:'One-time cost (USD)'},{key:'startMonth',label:'Starts in month'},{key:'durationMonths',label:'Lasts how many months?'}] as const).map(field => <div className="field" key={field.key}><label htmlFor={`lab-scenario-${field.key}`}>{field.label}</label><input id={`lab-scenario-${field.key}`} type="number" step={field.key === 'startMonth' || field.key === 'durationMonths' ? '1' : '0.01'} value={custom[field.key]} onChange={e => setCustom(previous => ({ ...previous, [field.key]: e.target.value }))} /></div>)}<p>The description is a label. Enter signed changes to existing amounts. Month 1 is next month; recurring changes stop after the duration, and the one-time cost occurs at the start. Keep the entire event within the selected horizon.</p></div>
        {!custom.label.trim() ? <p className="inline-notice">Start by describing your situation above. Add its financial changes to see your projection.</p> : scenarioError && <p role="alert" className="inline-notice">{scenarioError} Results and goal proposals are hidden until the scenario is valid.</p>}
      </section>
      <div className="lab-layout">
        <section className="panel lab-controls" aria-labelledby="lab-inputs-title">
          <div className="section-heading"><div><p className="eyebrow">SET YOUR STARTING POINT</p><h2 id="lab-inputs-title">The numbers in play.</h2></div><span className="tag">USD</span></div>
          <div className="lab-ranges">
            {controls.map((control) => <div className="lab-control" key={control.key}>
              <div className="lab-control__heading"><label htmlFor={`lab-${control.key}`}>{control.label}</label><span className="lab-number-input"><span aria-hidden="true">$</span><input id={`lab-${control.key}`} type="number" min="0" max={control.max} step="0.01" inputMode="decimal" value={draftInputs[control.key] ?? state.simulation[control.key]} aria-invalid={!!inputErrors[control.key]} aria-describedby={`lab-${control.key}-hint${inputErrors[control.key] ? ` lab-${control.key}-error` : ""}`} onChange={(event) => setInput(control.key, event.target.value, control.max)} /></span></div>
              <input className="range" aria-label={`Adjust ${control.label.toLowerCase()}`} type="range" min="0" max={control.max} step={control.step} value={state.simulation[control.key]} onChange={(event) => setInput(control.key, event.target.value, control.max, true)} />
              <p className="field-hint" id={`lab-${control.key}-hint`}>{control.hint}</p>
              {inputErrors[control.key] && <p className="form-error" id={`lab-${control.key}-error`} role="alert">{inputErrors[control.key]}</p>}
            </div>)}
          </div>
          <div className="lab-monthly-total"><span>Current outgoings / before shocks</span><strong>{currency(monthlyExpenses)}</strong></div>
          <div className="lab-monthly-total"><span>Current surplus / before shocks</span><strong>{currency(state.simulation.income - monthlyExpenses)}</strong></div>
        </section>

        <section hidden={!!scenarioError} className="panel lab-chart-panel" aria-labelledby="lab-chart-title">
          <div className="section-heading"><div><p className="eyebrow">THREE POSSIBLE PATHS</p><h2 id="lab-chart-title">Make the future tangible.</h2></div><span className="tag">{state.horizon} MONTHS</span></div>
          <figure className="path-chart">
            <svg viewBox="0 0 760 320" role="img" aria-labelledby={`${chartId}-title ${chartId}-desc`}>
              <title id={`${chartId}-title`}>{`Cash balance over ${state.horizon} months`}</title>
              <desc id={`${chartId}-desc`}>{`Comparing three deterministic paths under ${shock.title.toLowerCase()}. ${selected.label} ends at ${currency(selected.finalCash)}. Exact values are listed below the chart.`}</desc>
              {ticks.map((tick) => <g className="chart-grid" key={tick}><line x1={left} y1={y(tick)} x2={right} y2={y(tick)} /><text className="chart-label" x={left - 12} y={y(tick) + 4} textAnchor="end">{tick < 0 ? "−" : ""}${Math.abs(tick) >= 1000 ? `${Math.abs(tick) / 1000}k` : Math.abs(tick)}</text></g>)}
              {chartMin < 0 && <line className="chart-zero" x1={left} y1={y(0)} x2={right} y2={y(0)} stroke="currentColor" strokeWidth="1.5" />}
              {[0, state.horizon / 2, state.horizon].map((month) => <text className="chart-label" key={month} x={x(month)} y={bottom + 26} textAnchor="middle">{month === 0 ? "Today" : `${month} months`}</text>)}
              {paths.map((path) => <g key={path.id} opacity={path.id === selectedId ? 1 : 0.42}><polyline fill="none" points={path.points.map((point) => `${x(point.month)},${y(point.cash)}`).join(" ")} stroke={chartStyles[path.id].color} strokeWidth={path.id === selectedId ? 3.5 : 2} strokeDasharray={chartStyles[path.id].dash} strokeLinecap="round" /><circle cx={x(state.horizon)} cy={y(path.finalCash)} r={path.id === selectedId ? 5 : 3} fill={chartStyles[path.id].color} /></g>)}
            </svg>
            <figcaption>Cash balance · {state.horizon}-month projection · {shock.title.toLowerCase()}. A negative balance is an unfunded gap; borrowing costs are excluded.</figcaption>
          </figure>

          <div className="path-cards" role="group" aria-label="Choose a path to inspect">{paths.map((path, index) => <button key={path.id} type="button" className={`path-card ${selectedId === path.id ? "is-selected" : ""}`} aria-pressed={selectedId === path.id} onClick={() => setSelectedId(path.id)}><span className="path-card__index">0{index + 1} <span>{chartStyles[path.id].marker} line</span></span><strong>{path.label}</strong><span>{path.description}</span><span className="path-card__amount">{currency(path.finalCash)}</span><span className="field-hint">cash after {state.horizon} months</span></button>)}</div>

          <div className="path-metrics"><div><span className="eyebrow">SELECTED PATH</span><strong>{selected.label}</strong></div><div><span className="eyebrow">MONTHLY SURPLUS / BEFORE SHOCKS</span><strong>{currency(selected.monthlySurplus)}</strong></div><div><span className="eyebrow">LOWEST CASH BALANCE</span><strong>{currency(selected.minCash)}</strong></div></div>
          <div className="tool-message" role="status" aria-live="polite"><p className="eyebrow">RESILIENCE / {selected.label}</p><h3>{selected.stress.message}</h3><p>This path without the event ends at {currency(selected.stress.baseline.at(-1)!.cash)}, compared with {currency(selected.finalCash)} with it.</p><p>Extra starting cash to avoid a shortfall over this horizon: <strong>{currency(selected.stress.minimumExtraSavings)}</strong>. This is a break-even illustration, not a recommended cushion.</p></div>
          {selected.minCash < 0 && <p className="inline-notice risk-notice"><strong>Funding gap:</strong> This path goes below $0. The projection does not assume that new borrowing is available.</p>}
        </section>
      </div>

      <section hidden={!!scenarioError} className="lab-details-grid"><details className="panel assumptions"><summary>The assumptions behind the lines <Icon name="plus" size={18} /></summary><div><p>Every path starts with {currency(state.simulation.cash)} in cash. Each month: previous cash + take-home income − rent − transportation − other spending − any shock.</p><ul><li>Current path keeps your sample inputs unchanged.</li><li>Intentional spending reduces other spending by up to $200 each month, with a $0 floor.</li><li>Flexible housing reduces rent by up to $300 each month, with a $0 floor. Moving costs are excluded.</li>{selected.stress.assumptions.map(assumption => <li key={assumption}>{assumption}</li>)}</ul><p>All values are estimates for learning. A displayed negative balance remains a gap to resolve.</p></div></details><details className="panel assumptions"><summary>Compare the exact balances <Icon name="plus" size={18} /></summary><div className="table-scroll"><table className="comparison-table"><caption>Projected cash with {shock.title.toLowerCase()}</caption><thead><tr><th scope="col">Path</th><th scope="col">Now / after upfront costs</th>{([6, 12, 24] as Horizon[]).filter((month) => month <= state.horizon).map((month) => <th key={month} scope="col">Month {month}</th>)}</tr></thead><tbody>{paths.map((path) => <tr key={path.id}><th scope="row">{path.label}</th><td>{currency(path.points[0].cash)}</td>{([6, 12, 24] as Horizon[]).filter((month) => month <= state.horizon).map((month) => <td key={month}>{currency(path.points.find((point) => point.month === month)?.cash ?? 0)}</td>)}</tr>)}</tbody></table></div></details></section>

      <section hidden={!!scenarioError} className="lab-next-step panel"><div><p className="eyebrow">A SMALL NEXT STEP</p><h2>Turn a possibility<br />into a practice.</h2><p>Draft a savings goal from this path. You can inspect it, approve it, or decide against it.</p></div><div>{selected.monthlySurplus > 0 ? <button className="button button--primary" type="button" onClick={proposeGoal}>Propose a savings goal <Icon name="arrow-up-right" size={17} /></button> : <p className="inline-notice">This path has no monthly surplus. Try adjusting the sample costs before proposing a savings contribution.</p>}<Link className="text-link" href="/approach">Explore our approach <Icon name="arrow-right" size={15} /></Link><p className="field-hint">Local demo only. No transfer or notification is made.</p></div></section>
    </div>
  );
}
