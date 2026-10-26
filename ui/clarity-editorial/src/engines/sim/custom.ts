import { CITIES, annualTakeHome, federalTax } from "./tax.ts";
import { SCENARIOS, type Field, type Scenario, type Values } from "./scenarios.ts";
import type { Option } from "./types.ts";

// Any "A vs B" decision the user describes, built from a structured spec the AI
// fills in. The AI only supplies inputs; compare() does all the math. Every
// amount becomes an editable field, so the inputs panel and what-ifs work as
// they do for the preset scenarios.

type Income = { name: string; amount: number; basis: "monthly_take_home" | "annual_gross"; taxCity: string | null; stateLocalTaxPct: number; raisePct: number; startMonth?: number; endMonth?: number };
type Cost = { name: string; monthly: number; growthPct: number; startMonth?: number; endMonth?: number };
type OneTime = { name: string; amount: number; month: number };
type Debt = { name: string; balance: number; aprPct: number; minPayment: number; paymentsStartMonth?: number };
type Asset = { name: string; value: number; depreciationPct: number };
type Side = { label: string; startingCash: number; savingsApyPct: number; income: Income[]; costs: Cost[]; oneTime: OneTime[]; debts: Debt[]; assets: Asset[] };
export type CustomSpec = { title: string; years: number; a: Side; b: Side; assumptions: string[] };

const MAX_MONEY = 10_000_000;
const LIMITS = { income: 4, costs: 8, oneTime: 6, debts: 4, assets: 3 };
// When a salary's city isn't in the tax model, state + local tax is a flat rate.
const DEFAULT_STATE_LOCAL_PCT = 4;

class SpecError extends Error {}

const obj = (x: unknown): Record<string, unknown> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
const text = (x: unknown, fallback: string, max = 60) => (typeof x === "string" && x.trim() ? x.trim().slice(0, max) : fallback);
function num(x: unknown, min: number, max: number, fallback?: number): number {
  const v = typeof x === "string" ? Number(x.replace(/[$,%\s]/g, "")) : Number(x);
  if (x === undefined || x === null || x === "" || !Number.isFinite(v)) {
    if (fallback === undefined) throw new SpecError("A required amount is missing or not a number.");
    return fallback;
  }
  return Math.min(max, Math.max(min, v));
}
const month = (x: unknown, years: number) => (x === undefined || x === null || x === "" ? undefined : Math.round(num(x, 0, years * 12)));
const list = (x: unknown, limit: number) => (Array.isArray(x) ? x.slice(0, limit).map(obj) : []);

function parseSide(raw: unknown, fallbackLabel: string, years: number): Side {
  const s = obj(raw);
  const side: Side = {
    label: text(s.label, fallbackLabel, 40),
    startingCash: num(s.starting_cash, 0, MAX_MONEY, 0),
    savingsApyPct: num(s.savings_apy_pct, 0, 10, 0),
    income: list(s.income, LIMITS.income).map((i, k) => {
      const city = typeof i.tax_city === "string" && CITIES.some((c) => c.id === i.tax_city) ? i.tax_city : null;
      return {
        name: text(i.name, `Income ${k + 1}`), amount: num(i.amount, 0, MAX_MONEY),
        basis: i.basis === "annual_gross" ? "annual_gross" : "monthly_take_home",
        taxCity: city, stateLocalTaxPct: num(i.state_local_tax_pct, 0, 15, DEFAULT_STATE_LOCAL_PCT),
        raisePct: num(i.annual_raise_pct, 0, 50, 0), startMonth: month(i.start_month, years), endMonth: month(i.end_month, years),
      };
    }),
    costs: list(s.costs, LIMITS.costs).map((c, k) => ({
      name: text(c.name, `Cost ${k + 1}`), monthly: num(c.monthly, 0, MAX_MONEY), growthPct: num(c.annual_growth_pct, 0, 25, 0),
      startMonth: month(c.start_month, years), endMonth: month(c.end_month, years),
    })),
    oneTime: list(s.one_time, LIMITS.oneTime).map((c, k) => ({ name: text(c.name, `One-time cost ${k + 1}`), amount: num(c.amount, 0, MAX_MONEY), month: month(c.month, years) ?? 0 })),
    debts: list(s.debts, LIMITS.debts).map((d, k) => ({
      name: text(d.name, `Debt ${k + 1}`), balance: num(d.balance, 0, MAX_MONEY), aprPct: num(d.apr_pct, 0, 100, 0),
      minPayment: num(d.min_payment, 0, MAX_MONEY), paymentsStartMonth: month(d.payments_start_month, years),
    })),
    assets: list(s.assets, LIMITS.assets).map((a, k) => ({ name: text(a.name, `Asset ${k + 1}`), value: num(a.value, 0, MAX_MONEY), depreciationPct: num(a.annual_depreciation_pct, 0, 50, 0) })),
  };
  if (!side.income.length && !side.costs.length && !side.oneTime.length && !side.debts.length) {
    throw new SpecError(`Option "${side.label}" needs at least one income, cost, or debt.`);
  }
  return side;
}

/** Validates the AI's define_comparison arguments. Out-of-range amounts are clamped; missing required ones are errors. */
export function parseCustomSpec(args: unknown): { spec: CustomSpec } | { error: string } {
  try {
    const a = obj(args);
    const options = Array.isArray(a.options) ? a.options : [];
    if (options.length !== 2) throw new SpecError("Provide exactly two options to compare.");
    const years = Math.round(num(a.years, 1, 10, 5));
    const assumptions = (Array.isArray(a.assumptions) ? a.assumptions : []).filter((x): x is string => typeof x === "string").slice(0, 8).map((x) => x.slice(0, 200));
    return { spec: { title: text(a.title, "Your comparison", 80), years, a: parseSide(options[0], "Option A", years), b: parseSide(options[1], "Option B", years), assumptions } };
  } catch (error) {
    return { error: error instanceof SpecError ? error.message : "Could not read the comparison." };
  }
}

function takeHome(i: Income, gross: number): number {
  if (gross <= 0) return 0;
  return i.taxCity ? annualTakeHome(gross, i.taxCity) : gross - federalTax(gross) - (gross * i.stateLocalTaxPct) / 100;
}

const money = (key: string, label: string, group: "a" | "b"): Field => ({ key, label, kind: "money", group, min: 0, max: MAX_MONEY, step: 1 });
const percent = (key: string, label: string, group: "a" | "b", max: number): Field => ({ key, label, kind: "percent", group, min: 0, max, step: 0.5 });

function sideFields(s: Side, g: "a" | "b"): { fields: Field[]; defaults: Values } {
  const fields: Field[] = [money(`${g}_cash`, "Savings today", g)];
  const defaults: Values = { [`${g}_cash`]: s.startingCash };
  const add = (field: Field, value: number) => { fields.push(field); defaults[field.key] = value; };
  s.income.forEach((i, k) => {
    add(money(`${g}_inc${k}`, `${i.name} (${i.basis === "annual_gross" ? "gross / yr" : "take-home / mo"})`, g), i.amount);
    add(percent(`${g}_inc${k}_raise`, `${i.name} raise / yr`, g, 50), i.raisePct);
  });
  s.costs.forEach((c, k) => add(money(`${g}_cost${k}`, `${c.name} / mo`, g), c.monthly));
  s.oneTime.forEach((c, k) => add(money(`${g}_once${k}`, `${c.name} (${c.month === 0 ? "upfront" : `month ${c.month}`})`, g), c.amount));
  s.debts.forEach((d, k) => {
    add(money(`${g}_debt${k}`, `${d.name} balance`, g), d.balance);
    add(percent(`${g}_debt${k}_apr`, `${d.name} APR`, g, 100), d.aprPct);
    add(money(`${g}_debt${k}_min`, `${d.name} min payment / mo`, g), d.minPayment);
  });
  s.assets.forEach((a, k) => add(money(`${g}_asset${k}`, /value$/i.test(a.name) ? a.name : `${a.name} value`, g), a.value));
  return { fields, defaults };
}

function buildSide(s: Side, g: "a" | "b", v: Values): Option {
  const n = (key: string, fallback: number) => (Number.isFinite(Number(v[key])) ? Number(v[key]) : fallback);
  return {
    label: s.label,
    startingCash: n(`${g}_cash`, s.startingCash),
    cashApyPct: s.savingsApyPct,
    income: s.income.map((i, k) => {
      const amount = n(`${g}_inc${k}`, i.amount);
      const raise = n(`${g}_inc${k}_raise`, i.raisePct);
      const base = { name: i.name, startMonth: i.startMonth, endMonth: i.endMonth };
      // Gross salaries go through the tax model each year, as in the job-offer preset.
      return i.basis === "annual_gross"
        ? { ...base, monthly: 0, schedule: Array.from({ length: 11 }, (_, y) => takeHome(i, amount * (1 + raise / 100) ** y) / 12) }
        : { ...base, monthly: amount, annualRaisePct: raise };
    }),
    recurring: s.costs.map((c, k) => ({ name: c.name, monthly: n(`${g}_cost${k}`, c.monthly), annualGrowthPct: c.growthPct, startMonth: c.startMonth, endMonth: c.endMonth })),
    oneTime: s.oneTime.map((c, k) => ({ name: c.name, amount: n(`${g}_once${k}`, c.amount), month: c.month })),
    debts: s.debts.map((d, k) => ({
      name: d.name, balance: n(`${g}_debt${k}`, d.balance), aprPct: n(`${g}_debt${k}_apr`, d.aprPct),
      minPayment: n(`${g}_debt${k}_min`, d.minPayment), paymentsStartMonth: d.paymentsStartMonth,
    })),
    assets: s.assets.map((a, k) => ({ name: a.name, value: n(`${g}_asset${k}`, a.value), annualDepreciationPct: a.depreciationPct })),
  };
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function customScenario(spec: CustomSpec): Scenario {
  const a = sideFields(spec.a, "a");
  const b = sideFields(spec.b, "b");
  const taxNote = [spec.a, spec.b].some((s) => s.income.some((i) => i.basis === "annual_gross"))
    ? ["Gross salaries use simplified 2026 single-filer federal tax plus city tax where modeled, otherwise a flat state/local rate (4% unless stated)."]
    : [];
  return {
    // Same spec → same id, so replaying a conversation rebuilds the same scenario.
    id: `custom-${hash(JSON.stringify(spec))}`,
    title: spec.title,
    question: spec.title,
    groupLabels: { a: spec.a.label, b: spec.b.label },
    defaultYears: spec.years,
    fields: [...a.fields, ...b.fields],
    defaults: { ...a.defaults, ...b.defaults },
    followUps: [],
    build: (v) => [buildSide(spec.a, "a", v), buildSide(spec.b, "b", v)],
    assumptions: [...spec.assumptions, ...taxNote, "Leftover money pays down debt (highest APR first), then goes to savings."],
  };
}

// Custom scenarios live for the browser session, alongside the presets.
const registry = new Map<string, Scenario>();

export function registerCustomScenario(spec: CustomSpec): Scenario {
  const scenario = customScenario(spec);
  registry.set(scenario.id, scenario);
  return scenario;
}

export function lookupScenario(id: string | null | undefined): Scenario | undefined {
  if (!id) return undefined;
  return SCENARIOS.find((s) => s.id === id) ?? registry.get(id);
}
