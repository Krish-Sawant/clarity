import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { cases, conditions, publicCase } from './cases.mjs';
import { scoreRun } from './scoring.mjs';
import * as finance from '../finance.ts';

const [command, target] = process.argv.slice(2);
if (command === 'engine') {
  let failures = 0;
  for (const c of cases.filter(c => c.tool)) {
    let result;
    try { result = finance[c.tool](c.input, c.extraPaymentCents); }
    catch (error) {
      if (!(error instanceof RangeError)) throw error;
      result = { status: 'invalid_input' };
    }
    const failed = Object.entries(c.expected).filter(([field, value]) => !Object.is(result[field], value));
    failures += failed.length;
    console.log(`${failed.length ? 'FAIL' : 'PASS'} ${c.id}${failed.length ? ': ' + failed.map(([f]) => f).join(', ') : ''}`);
  }
  console.log('Engine fixture checks only; no chatbot or UI has been evaluated.');
  process.exitCode = failures ? 1 : 0;
} else if (command === 'init' && target) {
  const directory = resolve(target);
  await mkdir(directory, { recursive: true });
  // Exclusive writes protect collected data against accidental re-initialization.
  for (const condition of conditions) {
    await writeFile(join(directory, `${condition}.json`), JSON.stringify({
      runId: `${condition}-replace-with-unique-run-id`, condition, mode: 'manual',
      model: '', modelSettings: '', promptVersion: '', appVersion: '',
      responses: cases.map(c => ({ caseId: c.id, answer: '', facts: {}, review: { reviewer: '', notes: '', unsupportedClaims: null, understanding: null, tradeoffAwareness: null, actionControl: null } })),
    }, null, 2), { flag: 'wx' });
  }
  await writeFile(join(directory, 'tasks.json'), JSON.stringify(cases.map(publicCase), null, 2), { flag: 'wx' });
  await writeFile(join(directory, 'study.csv'), 'participantId,condition,order,taskId,completed,elapsedSeconds,comprehensionCorrect,comprehensionTotal,confidencePercent,tradeoffScore,visualAppealScore,notes\n', { flag: 'wx' });
  console.log(`Created blank response files, public tasks, and study template in ${directory}`);
} else if (command === 'score' && target) {
  console.log(JSON.stringify(scoreRun(JSON.parse(await readFile(target, 'utf8'))), null, 2));
} else {
  console.error('Usage: node --experimental-strip-types evaluation/run.mjs engine|init <directory>|score <responses.json>');
  process.exitCode = 1;
}
