import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customStressTest } from './stress.ts';
const input={savings:10000,monthlyIncome:4000,monthlyExpenses:3000,monthlyRent:1500};
const shock={label:'Reduced hours and repairs',incomeChange:-1000,expenseChange:200,oneTimeCost:500,startMonth:2,durationMonths:3};
test('custom changes start, stop and charge the one-time cost once',()=>{const r=customStressTest(input,shock);assert.equal(r.stressed[1].cash,11000);assert.equal(r.stressed[2].cash,10300);assert.equal(r.stressed[4].cash,9900);assert.equal(r.stressed[5].cash,10900);assert.equal(r.baseline[5].cash,15000);});
test('positive income and lower expenses are supported',()=>{assert.equal(customStressTest(input,{...shock,incomeChange:100,expenseChange:-100,oneTimeCost:0,startMonth:1,durationMonths:1}).stressed[1].cash,11200);});
test('invalid time bounds, money and negative resulting income are rejected',()=>{for(const patch of [{startMonth:0},{durationMonths:24},{incomeChange:-4001},{expenseChange:-3001},{oneTimeCost:-1},{incomeChange:NaN},{label:''}])assert.throws(()=>customStressTest(input,{...shock,...patch}),RangeError);});
