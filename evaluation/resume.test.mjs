import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkResume, isComplete, pacedRequest } from './resume.mjs';
const runs = () => Object.fromEntries(['A', 'B'].map(condition => [condition, { condition, mode: 'live', provider: 'gemini', model: 'test', runId: condition, modelSettings: 'defaults', promptVersion: 'v1', appVersion: 'test', responses: [] }]));
const protocol = { instructions: 'same', outputFormat: {}, toolDefinitions: [], tasks: [], coreVersion: 'core' };
test('resume requires consistent model and protocol', () => {
  checkResume(runs(), protocol, protocol, 'gemini', 'test');
  assert.throws(() => checkResume(runs(), protocol, protocol, 'gemini', 'different'), /different/);
  assert.throws(() => checkResume(runs(), protocol, { ...protocol, coreVersion: 'changed' }, 'gemini', 'test'), /core changed/);
});
test('only successful answers are skipped', () => {
  assert.equal(isComplete({ responses: [{ caseId: 'x', answer: 'ok' }] }, 'x'), true);
  assert.equal(isComplete({ responses: [{ caseId: 'x', answer: '', error: '429' }] }, 'x'), false);
});
test('pacing applies between individual requests without real sleeps', async () => {
  let time = 0; const waits = [];
  const request = pacedRequest(async () => 'ok', 15000, { now: () => time, sleep: async ms => { waits.push(ms); time += ms; } });
  await request({}); time += 1000; await request({});
  assert.deepEqual(waits, [14000]);
});
