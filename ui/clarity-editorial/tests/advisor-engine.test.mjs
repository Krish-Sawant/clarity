import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const moduleShim = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync('src/engines/advisor/engine.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(moduleShim.exports);
const {detect,plan} = moduleShim.exports;
const demo = JSON.parse(fs.readFileSync('src/engines/advisor/demo.json', 'utf8'));
test('demo fires all five distinct moments, independent of input order',()=>{
 const hits=detect(demo.transactions,demo.snapshots,demo.asOf);
 assert.equal(hits.length,5);
 assert.equal(new Set(hits.map(n=>n.kind)).size,5);
 assert.deepEqual(detect([...demo.transactions].reverse(),[...demo.snapshots].reverse(),demo.asOf),hits);
 assert.deepEqual(detect(demo.transactions,demo.snapshots,demo.asOf),hits);
});
test('empty and pre-event history does not infer new life moments',()=>{
 assert.deepEqual(detect([],[],demo.asOf),[]);
 assert.deepEqual(detect(demo.transactions, demo.snapshots,'2026-06-30'),[]);
});
test('a repeat employer or loan does not fire a first-time nudge',()=>{
 const prior=[{id:'prior-job',date:'2026-09-25',amount:4000,merchant:'Northstar Labs',category:'payroll'},{id:'prior-loan',date:'2026-09-26',amount:-280,merchant:'Student Loan Servicer',category:'student_loan'}];
 const hits=detect([...demo.transactions,...prior],demo.snapshots,demo.asOf);
 assert.ok(!hits.some(n=>['new-job','student-loan'].includes(n.kind)));
});
test('spending threshold uses three baseline months and excludes transfers',()=>{
 const rows=[6,7,8].map(m=>({id:`${m}`,date:`2026-0${m}-10`,amount:-100,merchant:'shop',category:'shopping'}));
 const current={id:'now',date:'2026-09-10',amount:-140,merchant:'shop',category:'shopping'};
 assert.ok(detect([...rows,current],[],'2026-09-30').some(n=>n.kind==='overspending'));
 assert.ok(!detect([...rows,{...current,amount:-139}],[],'2026-09-30').some(n=>n.kind==='overspending'));
 assert.ok(!detect([...rows,{...current,category:'transfer'}],[],'2026-09-30').some(n=>n.kind==='overspending'));
});
test('balance dips suppress idle-cash signal',()=>{
 assert.ok(!detect([],demo.snapshots.map((s,i)=>i===2?{...s,balance:100}:s),demo.asOf).some(n=>n.kind==='idle-cash'));
});
test('planner caps transfers at available surplus and rejects invalid values',()=>{
 assert.equal(plan('new-job',4800,3580,5100,4).monthly,610);
 assert.equal(plan('moving',100,200,0,0).monthly,0);
 assert.throws(()=>plan('idle-cash',NaN,0,0,4));
 assert.throws(()=>plan('student-loan',1,1,1,101));
});
