import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateFuturePaths } from '../src/api/future-lab';
import { simulatePaths } from '../src/lib/finance';
const inputs={income:4000,rent:1500,transportation:500,spending:1000,cash:12000};
test('unified no-shock paths preserve the original budgets',()=>{const next=simulateFuturePaths(inputs,'none',12);const old=simulatePaths(inputs,'none',12);next.forEach((p,i)=>assert.deepEqual(p.points,old[i].points));});
test('job loss uses each path costs and the shared starting cash',()=>{const paths=simulateFuturePaths(inputs,'job-loss',6);assert.equal(paths[0].finalCash,-6000);assert.equal(paths[1].finalCash,-4800);assert.equal(paths[2].finalCash,-4200);assert.equal(paths[0].stress.firstShortfallMonth,5);});
test('repair and percentage rent increase use displayed scenario terms',()=>{assert.equal(simulateFuturePaths(inputs,'repair',6)[0].points[0].cash,10000);const p=simulateFuturePaths(inputs,'rent-rise',6);assert.equal(p[0].finalCash,17100);assert.equal(p[2].finalCash,19080);});
test('custom inputs share one horizon and invalid intervals are rejected',()=>{const c={label:'Time off',incomeChange:-4000,expenseChange:0,oneTimeCost:500,startMonth:2,durationMonths:2};const p=simulateFuturePaths(inputs,'none',6,c);assert.equal(p[0].finalCash,9500);assert.equal(p[1].finalCash,10700);assert.throws(()=>simulateFuturePaths(inputs,'none',6,{...c,durationMonths:6}));});
