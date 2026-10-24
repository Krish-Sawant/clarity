import type { Comparison, Projection } from "./types.ts";

// Template "future you" message built only from computed results. Placeholder
// until the backend's AI endpoint exists; it should stay as the fallback.

export const usd = (x: number) =>
  `${x < 0 ? "-" : ""}$${Math.abs(Math.round(x)).toLocaleString("en-US")}`;

export const monthLabel = (m: number) => (m <= 12 ? `month ${m}` : `year ${Math.ceil(m / 12)} (month ${m})`);

function describe(p: Projection, months: number): string {
  const end = p.points[months];
  if (end.debt === 0 && end.assets === 0) return `${usd(end.cash)} saved`;
  const parts = [`${usd(end.cash)} saved`];
  if (end.assets > 0) parts.push(`${usd(end.assets)} in assets`);
  if (end.debt > 0) parts.push(`${usd(end.debt)} still owed`);
  return `${parts.join(", ")} (net worth ${usd(end.netWorth)})`;
}

export function futureYouMessage(c: Comparison, months: number): string[] {
  const years = Math.round(months / 12);
  const { a, b } = c;
  const lines = [
    `${years} year${years === 1 ? "" : "s"} from now: with "${a.label}" you have ${describe(a, months)}; ` +
      `with "${b.label}" you have ${describe(b, months)}.`,
  ];

  if (c.leaderAtEnd === "tie") {
    lines.push("They end up about even, so the decision comes down to what the numbers can't measure.");
  } else {
    const [lead, lag] = c.leaderAtEnd === "a" ? [a, b] : [b, a];
    const gap = lead.points[months].netWorth - lag.points[months].netWorth;
    const last = c.crossovers.at(-1);
    lines.push(
      last
        ? `${lag.label} starts out ahead, but ${lead.label} pulls ahead in ${monthLabel(last)} and finishes ${usd(gap)} ahead.`
        : `${lead.label} stays ahead the whole time and finishes ${usd(gap)} ahead.`,
    );
  }

  for (const p of [a, b]) {
    if (p.debtFreeMonth && p.debtFreeMonth > 0) lines.push(`${p.label}: debt-free in ${monthLabel(p.debtFreeMonth)}.`);
    else if (p.debtFreeMonth === null) lines.push(`${p.label}: debt isn't paid off within ${years} years.`);
    if (p.shortfallMonth !== null) {
      lines.push(`⚠️ ${p.label}: savings run out in ${monthLabel(p.shortfallMonth)} (lowest point ${usd(p.lowestCash)}). This plan needs a bigger cushion.`);
    }
  }

  lines.push("Neither choice is automatically right; the answer depends on these assumptions. Move the sliders to see how it changes.");
  return lines;
}
