import { amortizedPayment } from "./project.ts";
import { CITIES, annualTakeHome, cityById } from "./tax.ts";
import type { Debt, Option } from "./types.ts";

export type FieldKind = "money" | "percent" | "months" | "city" | "toggle";

export type Field = {
  key: string;
  label: string;
  kind: FieldKind;
  group: "a" | "b" | "shared";
  min?: number;
  max?: number;
  step?: number;
};

export type Values = Record<string, number | string | boolean>;

// The few inputs worth asking the user about; everything else uses defaults.
// "{a}" / "{b}" in text are replaced with the options' labels.
export type FollowUp = {
  question: string;
  fields: string[];
  choices: { label: string; values: Values }[];
};

export type Scenario = {
  id: string;
  title: string;
  question: string;
  groupLabels: { a: string; b: string };
  defaultYears: number;
  fields: Field[];
  defaults: Values;
  followUps: FollowUp[];
  // Extra field updates when one field changes (e.g. picking a city resets its rent).
  derive?: (key: string, values: Values) => Values;
  build: (values: Values) => [Option, Option];
  assumptions: string[];
};

export const CITY_OPTIONS = CITIES.map((c) => ({ value: c.id, label: c.name }));

const n = (v: Values, k: string) => Number(v[k]) || 0;
const s = (v: Values, k: string) => String(v[k]);
const b = (v: Values, k: string) => Boolean(v[k]);

const money = (key: string, label: string, group: Field["group"], max: number, step = 50): Field =>
  ({ key, label, kind: "money", group, min: 0, max, step });
const percent = (key: string, label: string, group: Field["group"], max: number, step = 0.5): Field =>
  ({ key, label, kind: "percent", group, min: 0, max, step });

function creditCard(v: Values): Debt[] {
  const balance = n(v, "cardBalance");
  if (balance <= 0) return [];
  // Typical issuer minimum: about 3% of the starting balance, at least $35.
  return [{ name: "Credit card", balance, aprPct: n(v, "cardApr"), minPayment: Math.max(35, Math.round(balance * 0.03)) }];
}

/* ---------- 1. Job offer in two cities ---------- */

const jobOffer: Scenario = {
  id: "job-offer",
  title: "Job offer: two cities",
  question: "Should I take the NYC offer at $95k or the Pittsburgh offer at $78k?",
  groupLabels: { a: "Offer A", b: "Offer B" },
  defaultYears: 5,
  fields: [
    { key: "cityA", label: "City", kind: "city", group: "a" },
    money("salaryA", "Salary (gross / yr)", "a", 250_000, 1000),
    percent("raiseA", "Expected raise / yr", "a", 25),
    money("rentA", "Rent / mo", "a", 6000),
    { key: "roommateA", label: "Roommate (pay 55% of rent)", kind: "toggle", group: "a" },
    money("otherA", "Other living costs / mo", "a", 5000),
    money("movingA", "Moving costs", "a", 10000, 100),
    { key: "cityB", label: "City", kind: "city", group: "b" },
    money("salaryB", "Salary (gross / yr)", "b", 250_000, 1000),
    percent("raiseB", "Expected raise / yr", "b", 25),
    money("rentB", "Rent / mo", "b", 6000),
    { key: "roommateB", label: "Roommate (pay 55% of rent)", kind: "toggle", group: "b" },
    money("otherB", "Other living costs / mo", "b", 5000),
    money("movingB", "Moving costs", "b", 10000, 100),
    money("startingCash", "Savings today", "shared", 50_000, 100),
    money("cardBalance", "Credit card balance", "shared", 20_000, 100),
    percent("cardApr", "Card APR", "shared", 36),
    percent("rentGrowth", "Rent increase / yr", "shared", 10),
  ],
  defaults: {
    cityA: "nyc", salaryA: 95_000, raiseA: 3, rentA: 2400, roommateA: false, otherA: 1900, movingA: 1500,
    cityB: "pittsburgh", salaryB: 78_000, raiseB: 3, rentB: 1300, roommateB: false, otherB: 1500, movingB: 1000,
    startingCash: 8000, cardBalance: 3000, cardApr: 24, rentGrowth: 3,
  },
  followUps: [
    {
      question: "How much do you have saved right now, and do you carry any credit card debt?",
      fields: ["startingCash", "cardBalance"],
      choices: [
        { label: "About $8k saved, $3k on a card", values: { startingCash: 8000, cardBalance: 3000 } },
        { label: "About $3k saved, no debt", values: { startingCash: 3000, cardBalance: 0 } },
        { label: "About $15k saved, no debt", values: { startingCash: 15_000, cardBalance: 0 } },
      ],
    },
    {
      question: "Does either job have a faster raise or promotion track?",
      fields: ["raiseA", "raiseB"],
      choices: [
        { label: "About the same (~3% a year)", values: { raiseA: 3, raiseB: 3 } },
        { label: "{a} grows faster (~12% a year)", values: { raiseA: 12, raiseB: 3 } },
        { label: "{b} grows faster (~12% a year)", values: { raiseA: 3, raiseB: 12 } },
      ],
    },
  ],
  derive: (key, v): Values => {
    if (key === "cityA") return { rentA: cityById(s(v, "cityA")).defaultRent };
    if (key === "cityB") return { rentB: cityById(s(v, "cityB")).defaultRent };
    return {};
  },
  build: (v) => {
    const side = (k: "A" | "B"): Option => {
      const city = cityById(s(v, `city${k}`));
      const salary = n(v, `salary${k}`);
      const raise = n(v, `raise${k}`);
      const rent = n(v, `rent${k}`) * (b(v, `roommate${k}`) ? 0.55 : 1);
      return {
        label: `${city.name}, $${Math.round(salary / 1000)}k`,
        startingCash: n(v, "startingCash"),
        // Recompute taxes on each year's raised salary instead of raising take-home directly.
        income: [{
          name: "Take-home pay", monthly: 0,
          schedule: Array.from({ length: 11 }, (_, y) => annualTakeHome(salary * (1 + raise / 100) ** y, city.id) / 12),
        }],
        recurring: [
          { name: "Rent", monthly: rent, annualGrowthPct: n(v, "rentGrowth") },
          { name: "Other living costs", monthly: n(v, `other${k}`), annualGrowthPct: 3 },
        ],
        oneTime: [{ name: "Deposit + first month + moving", amount: rent * 2 + n(v, `moving${k}`), month: 0 }],
        debts: creditCard(v),
        assets: [],
      };
    };
    return [side("A"), side("B")];
  },
  assumptions: [
    "Single filer, 2026 tax brackets, standard deduction, no pre-tax 401(k) or health premiums.",
    "Move-in = security deposit + first month's rent + moving costs (no broker fee).",
    "Other living costs grow 3% a year. Leftover money pays down the card first, then goes to savings.",
  ],
};

/* ---------- 2. Buy a car vs keep the old one ---------- */

const car: Scenario = {
  id: "car",
  title: "Buy a car vs keep the old one",
  question: "Should I finance a newer car or keep driving my old one?",
  groupLabels: { a: "Keep old car", b: "Buy newer car" },
  defaultYears: 5,
  fields: [
    money("oldValue", "Old car's value today", "a", 30_000, 250),
    money("repairs", "Average repairs / mo", "a", 1000, 10),
    percent("repairGrowth", "Repair cost increase / yr", "a", 30, 1),
    money("insuranceOld", "Insurance / mo", "a", 600, 10),
    money("price", "Car price", "b", 80_000, 500),
    money("downPayment", "Down payment", "b", 30_000, 250),
    percent("loanApr", "Loan APR", "b", 20, 0.25),
    { key: "loanMonths", label: "Loan length", kind: "months", group: "b", min: 12, max: 84, step: 12 },
    money("insuranceNew", "Insurance / mo", "b", 600, 10),
    money("maintenanceNew", "Maintenance / mo", "b", 500, 10),
    money("takeHome", "Take-home pay / mo", "shared", 15_000, 50),
    money("otherCosts", "Other living costs / mo", "shared", 10_000, 50),
    money("startingCash", "Savings today", "shared", 50_000, 100),
    percent("depreciation", "Car value loss / yr", "shared", 30, 1),
  ],
  defaults: {
    oldValue: 4000, repairs: 150, repairGrowth: 10, insuranceOld: 110,
    price: 26_000, downPayment: 3000, loanApr: 7.5, loanMonths: 60, insuranceNew: 170, maintenanceNew: 40,
    takeHome: 4200, otherCosts: 3200, startingCash: 6000, depreciation: 15,
  },
  followUps: [
    {
      question: "What's your current car worth, and roughly how much do you spend on repairs each month?",
      fields: ["oldValue", "repairs"],
      choices: [
        { label: "Worth ~$4k, ~$150/mo in repairs", values: { oldValue: 4000, repairs: 150 } },
        { label: "Worth ~$2k, ~$300/mo in repairs", values: { oldValue: 2000, repairs: 300 } },
        { label: "Worth ~$8k, barely any repairs", values: { oldValue: 8000, repairs: 40 } },
      ],
    },
    {
      question: "What car are you looking at, and how much could you put down?",
      fields: ["price", "downPayment"],
      choices: [
        { label: "$26k car, $3k down", values: { price: 26_000, downPayment: 3000 } },
        { label: "$18k used car, $2k down", values: { price: 18_000, downPayment: 2000 } },
        { label: "$35k car, $5k down", values: { price: 35_000, downPayment: 5000 } },
      ],
    },
  ],
  build: (v) => {
    const shared = { startingCash: n(v, "startingCash"), income: [{ name: "Take-home pay", monthly: n(v, "takeHome") }] };
    const living = { name: "Other living costs", monthly: n(v, "otherCosts"), annualGrowthPct: 3 };
    const loan = Math.max(0, n(v, "price") - n(v, "downPayment") - n(v, "oldValue"));
    const keep: Option = {
      ...shared,
      label: "Keep old car",
      recurring: [
        living,
        { name: "Repairs", monthly: n(v, "repairs"), annualGrowthPct: n(v, "repairGrowth") },
        { name: "Insurance", monthly: n(v, "insuranceOld") },
      ],
      oneTime: [],
      debts: [],
      assets: [{ name: "Old car", value: n(v, "oldValue"), annualDepreciationPct: n(v, "depreciation") }],
    };
    const buy: Option = {
      ...shared,
      label: "Buy newer car",
      recurring: [
        living,
        { name: "Insurance", monthly: n(v, "insuranceNew") },
        { name: "Maintenance", monthly: n(v, "maintenanceNew"), annualGrowthPct: 5 },
      ],
      oneTime: [{ name: "Down payment", amount: n(v, "downPayment"), month: 0 }],
      debts: loan > 0
        ? [{ name: "Car loan", balance: loan, aprPct: n(v, "loanApr"), minPayment: amortizedPayment(loan, n(v, "loanApr"), n(v, "loanMonths")) }]
        : [],
      assets: [{ name: "Newer car", value: n(v, "price"), annualDepreciationPct: n(v, "depreciation") }],
    };
    return [keep, buy];
  },
  assumptions: [
    "The old car is traded in toward the new one; its value lowers the loan amount.",
    "Net worth counts each car's estimated resale value, so depreciation shows up as a cost.",
    "Average repairs ignore the risk of one big breakdown; raise the repair slider to test that.",
  ],
};

/* ---------- 3. Grad school vs work now ---------- */

const gradSchool: Scenario = {
  id: "grad-school",
  title: "Grad school vs work now",
  question: "Should I get a master's degree or start working right away?",
  groupLabels: { a: "Work now", b: "Grad school" },
  defaultYears: 10,
  fields: [
    money("takeHomeNow", "Take-home pay / mo", "a", 15_000, 50),
    percent("raiseNow", "Expected raise / yr", "a", 15),
    { key: "schoolMonths", label: "Program length", kind: "months", group: "b", min: 6, max: 72, step: 6 },
    money("tuitionPerYear", "Tuition / yr (borrowed)", "b", 100_000, 500),
    percent("loanApr", "Student loan APR", "b", 12, 0.25),
    money("schoolIncome", "Income while in school / mo", "b", 5000, 50),
    money("takeHomeAfter", "Take-home after degree / mo", "b", 20_000, 50),
    percent("raiseAfter", "Expected raise / yr after", "b", 15),
    money("livingCosts", "Living costs / mo", "shared", 10_000, 50),
    money("startingCash", "Savings today", "shared", 50_000, 100),
  ],
  defaults: {
    takeHomeNow: 3900, raiseNow: 3,
    schoolMonths: 24, tuitionPerYear: 30_000, loanApr: 7.9, schoolIncome: 2400, takeHomeAfter: 5200, raiseAfter: 4,
    livingCosts: 2600, startingCash: 6000,
  },
  followUps: [
    {
      question: "What would you take home per month if you started working now, and after the degree?",
      fields: ["takeHomeNow", "takeHomeAfter"],
      choices: [
        { label: "$3,900 now, $5,200 after", values: { takeHomeNow: 3900, takeHomeAfter: 5200 } },
        { label: "$3,500 now, $6,000 after", values: { takeHomeNow: 3500, takeHomeAfter: 6000 } },
        { label: "$4,500 now, $5,000 after", values: { takeHomeNow: 4500, takeHomeAfter: 5000 } },
      ],
    },
    {
      question: "How long is the program, and what's the tuition per year?",
      fields: ["schoolMonths", "tuitionPerYear"],
      choices: [
        { label: "2 years, $30k/yr", values: { schoolMonths: 24, tuitionPerYear: 30_000 } },
        { label: "1 year, $45k", values: { schoolMonths: 12, tuitionPerYear: 45_000 } },
        { label: "2 years, funded (no tuition)", values: { schoolMonths: 24, tuitionPerYear: 0 } },
      ],
    },
  ],
  build: (v) => {
    const school = n(v, "schoolMonths");
    const living = { name: "Living costs", monthly: n(v, "livingCosts"), annualGrowthPct: 3 };
    const loan = n(v, "tuitionPerYear") * (school / 12);
    const apr = n(v, "loanApr");
    // 6-month grace period, then a standard 10-year repayment on the balance that has grown by then.
    const repayStart = school + 7;
    const balanceAtRepay = loan * (1 + apr / 1200) ** (repayStart - 1);
    const work: Option = {
      label: "Work now",
      startingCash: n(v, "startingCash"),
      income: [{ name: "Take-home pay", monthly: n(v, "takeHomeNow"), annualRaisePct: n(v, "raiseNow") }],
      recurring: [living],
      oneTime: [],
      debts: [],
      assets: [],
    };
    const grad: Option = {
      label: "Grad school",
      startingCash: n(v, "startingCash"),
      income: [
        { name: "Income during school", monthly: n(v, "schoolIncome"), endMonth: school },
        { name: "Take-home after degree", monthly: n(v, "takeHomeAfter"), annualRaisePct: n(v, "raiseAfter"), startMonth: school + 1 },
      ],
      recurring: [living],
      oneTime: [],
      debts: loan > 0
        ? [{ name: "Student loans", balance: loan, aprPct: apr, minPayment: amortizedPayment(balanceAtRepay, apr, 120), paymentsStartMonth: repayStart }]
        : [],
      assets: [],
    };
    return [work, grad];
  },
  assumptions: [
    "All tuition is borrowed up front; interest builds during school and a 6-month grace period.",
    "Loans are repaid over 10 years. Living costs are the same either way.",
    "If savings go negative during school, that gap would need more loans or family help.",
  ],
};

/* ---------- 4. Move out vs live at home ---------- */

const moveOut: Scenario = {
  id: "move-out",
  title: "Move out vs live at home",
  question: "Should I get my own apartment or keep living with my family for now?",
  groupLabels: { a: "Live at home", b: "Move out" },
  defaultYears: 3,
  fields: [
    money("familyRent", "Pay family / mo", "a", 3000, 25),
    money("homeCosts", "Other costs / mo", "a", 5000, 25),
    money("rent", "Rent / mo", "b", 6000, 25),
    { key: "roommate", label: "Roommate (pay 55% of rent)", kind: "toggle", group: "b" },
    money("utilities", "Utilities + internet / mo", "b", 1000, 10),
    money("outCosts", "Other costs / mo", "b", 5000, 25),
    money("furniture", "Furniture + setup", "b", 15_000, 100),
    money("takeHome", "Take-home pay / mo", "shared", 15_000, 50),
    percent("raise", "Expected raise / yr", "shared", 15),
    money("startingCash", "Savings today", "shared", 50_000, 100),
    money("cardBalance", "Credit card balance", "shared", 20_000, 100),
    percent("cardApr", "Card APR", "shared", 36),
  ],
  defaults: {
    familyRent: 300, homeCosts: 900,
    rent: 1400, roommate: false, utilities: 180, outCosts: 1200, furniture: 1500,
    takeHome: 3600, raise: 3, startingCash: 6000, cardBalance: 1500, cardApr: 24,
  },
  followUps: [
    {
      question: "What's your take-home pay per month, and how much do you have saved?",
      fields: ["takeHome", "startingCash"],
      choices: [
        { label: "$3,600/mo, $6k saved", values: { takeHome: 3600, startingCash: 6000 } },
        { label: "$2,800/mo, $2k saved", values: { takeHome: 2800, startingCash: 2000 } },
        { label: "$4,500/mo, $10k saved", values: { takeHome: 4500, startingCash: 10_000 } },
      ],
    },
    {
      question: "What rent are you looking at, and what would you pay your family to stay at home?",
      fields: ["rent", "familyRent"],
      choices: [
        { label: "$1,400 rent, $300 to family", values: { rent: 1400, familyRent: 300 } },
        { label: "$1,000 rent, nothing to family", values: { rent: 1000, familyRent: 0 } },
        { label: "$1,900 rent, $500 to family", values: { rent: 1900, familyRent: 500 } },
      ],
    },
  ],
  build: (v) => {
    const shared = {
      startingCash: n(v, "startingCash"),
      income: [{ name: "Take-home pay", monthly: n(v, "takeHome"), annualRaisePct: n(v, "raise") }],
      assets: [],
    };
    const rent = n(v, "rent") * (b(v, "roommate") ? 0.55 : 1);
    const home: Option = {
      ...shared,
      label: "Live at home",
      recurring: [
        { name: "Pay family", monthly: n(v, "familyRent") },
        { name: "Other costs", monthly: n(v, "homeCosts"), annualGrowthPct: 3 },
      ],
      oneTime: [],
      debts: creditCard(v),
    };
    const out: Option = {
      ...shared,
      label: "Move out",
      recurring: [
        { name: "Rent", monthly: rent, annualGrowthPct: 3 },
        { name: "Utilities", monthly: n(v, "utilities"), annualGrowthPct: 3 },
        { name: "Other costs", monthly: n(v, "outCosts"), annualGrowthPct: 3 },
      ],
      oneTime: [{ name: "Deposit + first month + furniture", amount: rent * 2 + n(v, "furniture"), month: 0 }],
      debts: creditCard(v),
    };
    return [home, out];
  },
  assumptions: [
    "Move-in = security deposit + first month's rent + furniture.",
    "Rent, utilities and other costs grow 3% a year.",
    "Money doesn't capture independence or family dynamics; those matter too.",
  ],
};

/* ---------- 5. Pay off debt vs build savings first ---------- */

const debtVsSave: Scenario = {
  id: "debt-vs-save",
  title: "Pay off debt vs save first",
  question: "Should I throw everything at my credit card, or build an emergency fund first?",
  groupLabels: { a: "Debt first", b: "Savings first" },
  defaultYears: 3,
  fields: [
    money("buffer", "Keep at least (small buffer)", "a", 10_000, 100),
    money("emergencyTarget", "Emergency fund target", "b", 30_000, 250),
    money("takeHome", "Take-home pay / mo", "shared", 15_000, 50),
    money("costs", "Living costs / mo", "shared", 10_000, 50),
    money("startingCash", "Savings today", "shared", 50_000, 100),
    money("cardBalance", "Credit card balance", "shared", 30_000, 100),
    percent("cardApr", "Card APR", "shared", 36),
    percent("savingsApy", "Savings account APY", "shared", 8, 0.25),
  ],
  defaults: {
    buffer: 1000, emergencyTarget: 7500, takeHome: 3400, costs: 2700, startingCash: 1000,
    cardBalance: 5000, cardApr: 24, savingsApy: 4,
  },
  followUps: [
    {
      question: "How much is on the card, and what's the APR?",
      fields: ["cardBalance", "cardApr"],
      choices: [
        { label: "$5k at 24%", values: { cardBalance: 5000, cardApr: 24 } },
        { label: "$2k at 29%", values: { cardBalance: 2000, cardApr: 29 } },
        { label: "$12k at 21%", values: { cardBalance: 12_000, cardApr: 21 } },
      ],
    },
    {
      question: "What do you take home each month, and what do you spend?",
      fields: ["takeHome", "costs"],
      choices: [
        { label: "$3,400 in, $2,700 out", values: { takeHome: 3400, costs: 2700 } },
        { label: "$2,800 in, $2,500 out", values: { takeHome: 2800, costs: 2500 } },
        { label: "$5,000 in, $3,500 out", values: { takeHome: 5000, costs: 3500 } },
      ],
    },
  ],
  build: (v) => {
    const base = {
      startingCash: n(v, "startingCash"),
      income: [{ name: "Take-home pay", monthly: n(v, "takeHome") }],
      recurring: [{ name: "Living costs", monthly: n(v, "costs") }],
      oneTime: [],
      assets: [],
      cashApyPct: n(v, "savingsApy"),
    };
    return [
      { ...base, label: "Debt first", debts: creditCard(v), cashFloorBeforeExtraDebt: n(v, "buffer") },
      { ...base, label: "Savings first", debts: creditCard(v), cashFloorBeforeExtraDebt: n(v, "emergencyTarget") },
    ];
  },
  assumptions: [
    "Both plans always make the card minimum (about 3% of the starting balance).",
    "Debt first: everything above the small buffer goes to the card. Savings first: extra goes to the card only after the emergency fund is full.",
    "Savings earn the APY monthly; the card charges APR / 12 each month.",
  ],
};

export const SCENARIOS: Scenario[] = [jobOffer, car, gradSchool, moveOut, debtVsSave];
