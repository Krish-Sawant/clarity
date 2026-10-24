import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCase, executeTool, openAIRequest } from './model-runner.mjs';
const task = { input: { balanceCents: 10000, aprPercent: 0, monthlyPaymentCents: 3000 }, prompt: 'When will I pay this off?', expected: { secretAnswer: 42 }, rubric: 'PRIVATE' };
const final = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ answer: 'Four months.', facts: [{ field: 'monthsToPayoff', value: 4 }] }) }] }] };
test('A gets no tools, keys, or private grading data', async () => {
  const r = await runCase({ task, condition: 'A', model: 'test', request: async body => {
    assert.equal(body.tools, undefined);
    assert.ok(!JSON.stringify(body).includes('secretAnswer')); assert.ok(!JSON.stringify(body).includes('PRIVATE'));
    return final;
  }});
  assert.equal(r.facts.monthsToPayoff, 4);
});
test('B executes the actual calculator and returns tool output before final answer', async () => {
  let calls = 0;
  const r = await runCase({ task, condition: 'B', model: 'test', request: async body => {
    assert.equal(body.tools.length, 2);
    if (++calls === 1) return { status: 'completed', output: [{ type: 'function_call', name: 'calculateDebt', call_id: 'test-call', arguments: JSON.stringify({ ...task.input, maxMonths: null }) }] };
    const result = body.input.find(x => x.type === 'function_call_output');
    assert.equal(result.call_id, 'test-call'); assert.equal(JSON.parse(result.output).monthsToPayoff, 4);
    return final;
  }});
  assert.equal(calls, 2); assert.equal(r.facts.monthsToPayoff, 4);
});
test('tool dispatch restricts names and converts validation errors', () => {
  assert.ok(executeTool({ name: 'constructor', arguments: '{}' }).error);
  assert.equal(executeTool({ name: 'calculateDebt', arguments: JSON.stringify({ ...task.input, balanceCents: -1 }) }).status, 'invalid_input');
});
test('incomplete and refused output stays unanswered', async () => {
  const r = await runCase({ task, condition: 'A', model: 'test', request: async () => ({ ...final, status: 'incomplete' }) });
  assert.equal(r.answer, ''); assert.ok(r.error);
});
test('tool loops are bounded and preserve trace', async () => {
  const r = await runCase({ task, condition: 'B', model: 'test', maxTurns: 2, request: async () => ({ status: 'completed', output: [{ type: 'function_call', name: 'calculateDebt', call_id: 'loop', arguments: JSON.stringify(task.input) }] }) });
  assert.match(r.error, /limit/); assert.equal(r.trace.length, 4);
});
test('HTTP failure does not expose raw body or API credential', async () => {
  const request = openAIRequest('secret-test-key', async () => ({ ok: false, status: 401, text: async () => 'secret-test-key' }));
  await assert.rejects(request({}), error => /401/.test(error.message) && !error.message.includes('secret-test-key'));
});
