"use client";

// Result and input pieces the chat renders for its chart, table and slider blocks.

import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ChartMetric } from "@/lib/chat/types";
import { usd } from "@/lib/sim/message";
import { CITY_OPTIONS, type Field, type Scenario, type Values } from "@/lib/sim/scenarios";
import { TABLE_ROWS, TABLE_ROW_KEYS, type TableRow, type TableRowKey } from "@/lib/sim/summary";
import type { Comparison } from "@/lib/sim/types";

export const COLOR_A = "#2563eb";
export const COLOR_B = "#ea580c";

/* ---------- Inputs ---------- */

export function applyField(scenario: Scenario, prev: Values, key: string, value: Values[string]): Values {
  const next = { ...prev, [key]: value };
  return { ...next, ...scenario.derive?.(key, next) };
}

export function ScenarioControls({ scenario, values, onChange }: {
  scenario: Scenario;
  values: Values;
  onChange: (key: string, value: Values[string]) => void;
}) {
  const group = (g: Field["group"]) => scenario.fields.filter((f) => f.group === g);
  return (
    <>
      <FieldGroup title={scenario.groupLabels.a} color={COLOR_A} fields={group("a")} values={values} onChange={onChange} />
      <FieldGroup title={scenario.groupLabels.b} color={COLOR_B} fields={group("b")} values={values} onChange={onChange} />
      <FieldGroup title="Both options" fields={group("shared")} values={values} onChange={onChange} />
    </>
  );
}

export function YearsSlider({ years, onChange }: { years: number; onChange: (y: number) => void }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <label className="shrink-0">Time horizon</label>
      <input type="range" min={1} max={10} value={years} onChange={(e) => onChange(Number(e.target.value))} className="w-full" aria-label="Time horizon in years" />
      <span className="w-16 shrink-0 text-right">{years} yr</span>
    </div>
  );
}

function FieldGroup({ title, color, fields, values, onChange }: {
  title: string;
  color?: string;
  fields: Field[];
  values: Values;
  onChange: (key: string, value: Values[string]) => void;
}) {
  if (!fields.length) return null;
  return (
    <fieldset className="rounded border border-zinc-300 p-3 dark:border-zinc-700" style={color ? { borderLeft: `4px solid ${color}` } : undefined}>
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <div className="space-y-3">
        {fields.map((f) => (
          <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => onChange(f.key, v)} />
        ))}
      </div>
    </fieldset>
  );
}

function formatValue(kind: Field["kind"], v: number): string {
  if (kind === "money") return usd(v);
  if (kind === "percent") return `${v}%`;
  return `${v} mo`;
}

function FieldInput({ field, value, onChange }: { field: Field; value: Values[string]; onChange: (v: Values[string]) => void }) {
  if (field.kind === "city") {
    return (
      <label className="flex items-center justify-between gap-2 text-sm">
        {field.label}
        <select value={String(value)} onChange={(e) => onChange(e.target.value)} className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700">
          {CITY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (field.kind === "toggle") {
    return (
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {field.label}
      </label>
    );
  }
  const num = Number(value) || 0;
  return (
    <div className="text-sm">
      <div className="flex justify-between">
        <span>{field.label}</span>
        <span className="font-mono">{formatValue(field.kind, num)}</span>
      </div>
      <input
        type="range"
        min={field.min}
        max={field.max}
        step={field.step}
        value={num}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        aria-label={field.label}
      />
    </div>
  );
}

/* ---------- Results ---------- */

const METRIC_TITLES: Record<ChartMetric, string> = {
  netWorth: "Net worth over time (savings + assets − debt)",
  cash: "Savings over time",
  debt: "Debt remaining over time",
};

export function ResultChart({ result, months, metric = "netWorth", title }: {
  result: Comparison;
  months: number;
  metric?: ChartMetric;
  title?: string;
}) {
  const data = result.a.points.map((p, i) => ({
    month: p.month,
    a: Math.round(p[metric]),
    b: Math.round(result.b.points[i][metric]),
  }));
  const yearTicks = Array.from({ length: months / 12 + 1 }, (_, y) => y * 12);
  return (
    <div>
      <h2 className="mb-2 font-medium">{title ?? METRIC_TITLES[metric]}</h2>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="month" type="number" domain={[0, months]} ticks={yearTicks} tickFormatter={(m) => `Y${m / 12}`} />
            <YAxis tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} width={60} />
            <Tooltip formatter={(v) => usd(Number(v))} labelFormatter={(m) => `Month ${m}`} />
            <Legend />
            <ReferenceLine y={0} stroke="#888" />
            {metric === "netWorth" &&
              result.crossovers.map((m) => (
                <ReferenceLine key={m} x={m} stroke="#16a34a" strokeDasharray="4 4" label={{ value: "lead changes", position: "insideTopRight", fontSize: 12 }} />
              ))}
            <Line type="monotone" dataKey="a" name={result.a.label} stroke={COLOR_A} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="b" name={result.b.label} stroke={COLOR_B} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function FutureYouCard({ lines, note }: { lines: string[]; note?: string }) {
  return (
    <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/40">
      <h2 className="mb-2 font-medium">Future you</h2>
      <div className="space-y-1.5 text-sm">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        {note ?? "Written from the computed numbers by a template. An AI-written version will replace this once the backend endpoint exists."}
      </p>
    </div>
  );
}

export function SummaryTable({ result, months, rows = TABLE_ROW_KEYS }: { result: Comparison; months: number; rows?: TableRowKey[] }) {
  const visible = rows.filter((k) => months >= ((TABLE_ROWS[k] as TableRow).minMonths ?? 0));
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-300 text-left dark:border-zinc-700">
          <th className="py-2" />
          <th className="py-2 text-right" style={{ color: COLOR_A }}>{result.a.label}</th>
          <th className="py-2 text-right" style={{ color: COLOR_B }}>{result.b.label}</th>
        </tr>
      </thead>
      <tbody>
        {visible.map((key) => {
          const row: TableRow = TABLE_ROWS[key];
          return (
            <tr key={key} className="border-b border-zinc-200 dark:border-zinc-800">
              <td className="py-1.5">{row.label(months)}</td>
              {[result.a, result.b].map((p) => (
                <td key={p.label} className={`py-1.5 text-right font-mono ${row.bad?.(p) ? "text-red-600" : ""}`}>
                  {row.value(p, months)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function Assumptions({ scenario }: { scenario: Scenario }) {
  return (
    <details className="text-sm text-zinc-500">
      <summary className="cursor-pointer">Assumptions</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {scenario.assumptions.map((a) => (
          <li key={a}>{a}</li>
        ))}
        <li>Illustrative estimates for learning, not financial or tax advice.</li>
      </ul>
    </details>
  );
}
