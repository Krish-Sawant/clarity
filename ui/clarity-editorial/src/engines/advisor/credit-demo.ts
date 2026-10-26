import type { Transaction } from './engine.ts';
export const CREDIT_DEMO_AS_OF = '2026-10-24';
export const CREDIT_DEMO_COVERAGE = '2026-07-01';
export const CREDIT_DEMO_TRANSACTIONS: Transaction[] = [
  ...['07', '08', '09'].flatMap(m => [
    { id: `${m}-dining`, date: `2026-${m}-15`, amount: -400, merchant: 'Demo dining', category: 'dining' },
    { id: `${m}-gas`, date: `2026-${m}-15`, amount: -150, merchant: 'Demo fuel', category: 'gas' },
    { id: `${m}-groceries`, date: `2026-${m}-15`, amount: -100, merchant: 'Demo groceries', category: 'groceries' },
    { id: `${m}-rent`, date: `2026-${m}-01`, amount: -1000, merchant: 'Demo rent', category: 'housing' },
  ]),
  { id: 'paycheck', date: '2026-10-20', amount: 3200, merchant: 'Demo employer', category: 'payroll' },
];
