/** UI validation boundary around the merged credit-card readiness comparison. */
import type { Transaction } from "../../../../frontend/src/lib/advisor/engine";
import { compareCardReadiness, detectCreditMoment, type Readiness } from "../../../../frontend/src/lib/advisor/credit";
import { CREDIT_DEMO_AS_OF, CREDIT_DEMO_COVERAGE, CREDIT_DEMO_TRANSACTIONS } from "../../../../frontend/src/lib/advisor/credit-demo";
import { record } from "./purchase";

export type { Readiness };
export type CardReadinessResult = ReturnType<typeof compareCardReadiness>;

/** Same synthetic activity used by the merged frontend preview. */
export const cardDemo = { asOf: CREDIT_DEMO_AS_OF, coveredFrom: CREDIT_DEMO_COVERAGE, transactions: CREDIT_DEMO_TRANSACTIONS };
export const unansweredReadiness: Readiness = { repayment: "unknown", missedPayments: "unknown", historyConfirmed: "unknown" };
const interestExample: Transaction = { id: "demo-interest-fee", date: CREDIT_DEMO_AS_OF, amount: -35, merchant: "Card interest charge", category: "credit_card_interest" };

const choices = { repayment: ["full", "carry", "first-card", "unknown"], missedPayments: ["yes", "no", "unknown"], historyConfirmed: ["yes", "no", "unknown"] } as const;

export function cardActivity(includeInterestExample: boolean): Transaction[] {
  return includeInterestExample ? [...cardDemo.transactions, interestExample] : cardDemo.transactions;
}

export function createCardReadiness(input: unknown) {
  if (!record(input) || !record(input.readiness) || typeof input.includeInterestExample !== "boolean") throw new RangeError("Answer the readiness questions for this activity.");
  const answers = input.readiness;
  for (const key of Object.keys(choices) as (keyof typeof choices)[]) {
    if (!(choices[key] as readonly unknown[]).includes(answers[key])) throw new RangeError("Choose one of the listed readiness answers.");
  }
  const readiness = { repayment: answers.repayment, missedPayments: answers.missedPayments, historyConfirmed: answers.historyConfirmed } as Readiness;
  const activity = cardActivity(input.includeInterestExample);
  return { activity, result: compareCardReadiness(activity, cardDemo.asOf, cardDemo.coveredFrom, readiness), moment: detectCreditMoment(activity, cardDemo.asOf) };
}
