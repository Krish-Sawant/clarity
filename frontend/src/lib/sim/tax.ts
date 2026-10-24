// Simplified 2026 take-home estimate for a single filer with W-2 wages only:
// standard deduction, no pre-tax retirement or health deductions, no credits.
// Good enough to compare two offers; not tax advice.

type Bracket = [upTo: number, ratePct: number];

function progressive(taxable: number, brackets: Bracket[]): number {
  let tax = 0;
  let lower = 0;
  for (const [upTo, rate] of brackets) {
    if (taxable <= lower) break;
    tax += ((Math.min(taxable, upTo) - lower) * rate) / 100;
    lower = upTo;
  }
  return tax;
}

const FEDERAL_STANDARD_DEDUCTION = 16_100;
const FEDERAL: Bracket[] = [
  [12_400, 10], [50_400, 12], [105_700, 22], [201_775, 24], [256_225, 32], [640_600, 35], [Infinity, 37],
];
const SOCIAL_SECURITY_WAGE_BASE = 184_500;

function federalTax(gross: number): number {
  const income = progressive(Math.max(0, gross - FEDERAL_STANDARD_DEDUCTION), FEDERAL);
  const socialSecurity = Math.min(gross, SOCIAL_SECURITY_WAGE_BASE) * 0.062;
  const medicare = gross * 0.0145 + Math.max(0, gross - 200_000) * 0.009;
  return income + socialSecurity + medicare;
}

const NY_STANDARD_DEDUCTION = 8_000;
const NY: Bracket[] = [
  [8_500, 3.9], [11_700, 4.4], [13_900, 5.15], [80_650, 5.4], [215_400, 5.9], [1_077_550, 6.85],
  [5_000_000, 9.65], [25_000_000, 10.3], [Infinity, 10.9],
];
const NYC: Bracket[] = [[12_000, 3.078], [25_000, 3.762], [50_000, 3.819], [Infinity, 3.876]];

const nyTaxable = (gross: number) => Math.max(0, gross - NY_STANDARD_DEDUCTION);
const paTax = (gross: number) => gross * 0.0307;
const ilTax = (gross: number) => Math.max(0, gross - 2_850) * 0.0495;

export type City = {
  id: string;
  name: string;
  // Rough 1-bedroom asking rent; the UI lets people override it.
  defaultRent: number;
  stateLocalTax: (gross: number) => number;
};

export const CITIES: City[] = [
  {
    id: "nyc", name: "New York City", defaultRent: 2400,
    stateLocalTax: (g) => progressive(nyTaxable(g), NY) + progressive(nyTaxable(g), NYC),
  },
  // 3% earned income tax (city + school district) plus the $52 local services tax.
  { id: "pittsburgh", name: "Pittsburgh", defaultRent: 1300, stateLocalTax: (g) => paTax(g) + g * 0.03 + 52 },
  { id: "philadelphia", name: "Philadelphia", defaultRent: 1600, stateLocalTax: (g) => paTax(g) + g * 0.0374 },
  { id: "chicago", name: "Chicago", defaultRent: 1800, stateLocalTax: ilTax },
  { id: "austin", name: "Austin", defaultRent: 1500, stateLocalTax: () => 0 },
  { id: "seattle", name: "Seattle", defaultRent: 2100, stateLocalTax: () => 0 },
];

export function cityById(id: string): City {
  return CITIES.find((c) => c.id === id) ?? CITIES[0];
}

export function annualTakeHome(gross: number, cityId: string): number {
  if (gross <= 0) return 0;
  return gross - federalTax(gross) - cityById(cityId).stateLocalTax(gross);
}
