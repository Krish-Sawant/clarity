import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geminiRequest } from './gemini.mjs';
import { runCase } from './model-runner.mjs';
const task = { input: { balanceCents: 10000, aprPercent: 0, monthlyPaymentCents: 3000 }, prompt: 'Explain payoff.' };
const final = { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({ answer: 'Four months.', facts: [{ field: 'monthsToPayoff', value: 4 }] }) } }] };
test('Gemini A uses correct endpoint, no tools and parses facts', async () => {
  const request = geminiRequest('test-key', async (url, options) => {
    assert.match(url, /^https:\/\/generativelanguage.googleapis.com\//);
    const payload = JSON.parse(options.body); assert.equal(payload.tools, undefined);
    assert.equal(payload.response_format.type, 'json_schema');
    return { ok: true, json: async () => final };
  });
  const result = await runCase({ task, condition: 'A', model: 'test', request });
  assert.equal(result.facts.monthsToPayoff, 4);
  assert.ok(!JSON.stringify(result.trace).includes('test-key'));
});
test('Gemini B preserves tool message signatures and returns real calculator result', async () => {
  let n = 0;
  const message = { role: 'assistant', content: null, tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'calculateDebt', arguments: JSON.stringify(task.input) }, extra_content: { google: { thought_signature: 'signature' } } }] };
  const request = geminiRequest('test-key', async (_, options) => {
    const body = JSON.parse(options.body); assert.equal(body.tools.length, 2);
    if (++n === 1) return { ok: true, json: async () => ({ choices: [{ finish_reason: 'tool_calls', message }] }) };
    assert.deepEqual(body.messages[2], message);
    assert.equal(JSON.parse(body.messages[3].content).monthsToPayoff, 4);
    return { ok: true, json: async () => final };
  });
  const result = await runCase({ task, condition: 'B', model: 'test', request });
  assert.equal(n, 2); assert.equal(result.facts.monthsToPayoff, 4);
});
test('Gemini quota failures are explicit and do not expose key', async () => {
  const request = geminiRequest('private', async () => ({ ok: false, status: 429 }));
  const r = await runCase({ task, condition: 'A', model: 'test', request });
  assert.match(r.error, /429/); assert.equal(r.answer, ''); assert.ok(!r.error.includes('private'));
});
