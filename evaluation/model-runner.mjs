import { calculateDebt, compareExtraPayment } from '../finance.ts';

export const instructions = `You are a financial education advisor working with synthetic USD data.
Explain the customer's task clearly and state limitations. Do not invent sources, probabilities,
affordability, or successful actions. No payment execution is available. The supported projection
model has fixed APR and payments, monthly interest rounded to cents before a month-end payment,
no fees or new borrowing, and a default 1200-month horizon. Time-varying payments are unsupported.
Money is integer cents; APR is a percentage (12 means 12%). Validate nonnegative integer money
up to 1e12 cents, APR from 0 to 1000, and horizon from 1 to 1200. Cap final payment at amount owed.
Statuses: paid_off, payment_too_low (fixed payment cannot reduce principal), horizon_exceeded,
invalid_input. A non-completed payoff duration is null, not zero. Already-paid debt takes zero
months. Comparison savings are null unless both plans pay off.
If calculation tools are available, use them for supported numerical projections.
Return an answer for the customer plus facts containing only claims explicitly made in that answer.
Use field names status, monthsToPayoff, totalInterestCents, totalPaymentsCents, remainingCents,
monthsSaved, interestSavedCents as applicable. Omit facts not asserted. Do not guess missing facts.
Facts are self-reported claims, not a correctness assessment. Keep the explanation in plain language.`;

const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const number = { type: 'number' };
const debtProperties = { balanceCents: number, aprPercent: number, monthlyPaymentCents: number, maxMonths: { type: ['integer', 'null'] } };
export const toolDefinitions = [
  { type: 'function', name: 'calculateDebt', description: 'Calculate a fixed-payment debt projection; validates inputs.', strict: true, parameters: object(debtProperties) },
  { type: 'function', name: 'compareExtraPayment', description: 'Compare fixed regular and extra monthly payments.', strict: true, parameters: object({ ...debtProperties, extraPaymentCents: number }) },
];
export const outputFormat = {
  type: 'json_schema', name: 'evaluation_answer', strict: true,
  schema: object({ answer: { type: 'string' }, facts: { type: 'array', items: object({ field: { type: 'string' }, value: { type: ['number', 'string', 'null'] } }) } }),
};

export function executeTool(call) {
  if (!['calculateDebt', 'compareExtraPayment'].includes(call.name)) return { error: 'Unsupported tool' };
  try {
    const args = JSON.parse(call.arguments);
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new RangeError('Expected argument object');
    const allowed = [...Object.keys(debtProperties), ...(call.name === 'compareExtraPayment' ? ['extraPaymentCents'] : [])];
    if (Object.keys(args).some(k => !allowed.includes(k))) throw new RangeError('Unexpected argument');
    const { extraPaymentCents, ...input } = args;
    if (input.maxMonths === null) delete input.maxMonths;
    const result = call.name === 'calculateDebt' ? calculateDebt(input) : compareExtraPayment(input, extraPaymentCents);
    // Summaries plus initial rows are sufficient for this fixed evaluation suite.
    const compact = r => ({ ...r, schedule: r.schedule.slice(0, 2), scheduleTruncated: r.schedule.length > 2 });
    return call.name === 'calculateDebt' ? compact(result) : { ...result, baseline: compact(result.baseline), accelerated: compact(result.accelerated) };
  } catch (error) {
    if (error instanceof RangeError || error instanceof SyntaxError) return { status: 'invalid_input', error: error.message };
    throw error;
  }
}

export function parseAnswer(response) {
  const content = (response.output ?? []).filter(x => x.type === 'message').flatMap(x => x.content ?? []);
  if (content.some(x => x.type === 'refusal')) throw new Error('Model refused this task');
  const data = JSON.parse(content.filter(x => x.type === 'output_text').map(x => x.text).join(''));
  if (typeof data.answer !== 'string' || !data.answer.trim() || !Array.isArray(data.facts)) throw new Error('Invalid answer shape');
  const facts = Object.create(null);
  for (const item of data.facts) {
    if (typeof item.field !== 'string' || Object.hasOwn(facts, item.field) || !['number', 'string'].includes(typeof item.value) && item.value !== null) throw new Error('Invalid or duplicate fact');
    facts[item.field] = item.value;
  }
  return { answer: data.answer, facts };
}

export async function runCase({ task, condition, model, request, maxTurns = 4 }) {
  if (!['A', 'B'].includes(condition)) throw new Error('Only A/B model conditions are supported');
  // Explicitly select public fields. Answer keys and rubrics cannot enter prompts.
  const input = [{ role: 'user', content: JSON.stringify({ input: task.input, ...(task.extraPaymentCents !== undefined ? { extraPaymentCents: task.extraPaymentCents } : {}), question: task.prompt }) }];
  const trace = [];
  const started = Date.now();
  try {
    for (let turn = 0; turn < maxTurns; turn++) {
      const body = { model, instructions, input: [...input], store: false, max_output_tokens: 4000, text: { format: outputFormat }, ...(condition === 'B' ? { tools: toolDefinitions, parallel_tool_calls: false } : {}) };
      const response = await request(body);
      trace.push({ request: body, response });
      if (response.status !== 'completed') throw new Error(`Response not completed: ${response.status}`);
      const calls = (response.output ?? []).filter(x => x.type === 'function_call');
      if (!calls.length) return { ...parseAnswer(response), trace, elapsedMs: Date.now() - started };
      if (condition === 'A') throw new Error('Unexpected tool call in condition A');
      if (calls.length > 4) throw new Error('Too many tool calls in one response');
      input.push(...response.output);
      for (const call of calls) {
        const output = executeTool(call);
        trace.push({ tool: call.name, callId: call.call_id, output });
        input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(output) });
      }
    }
    throw new Error('Tool turn limit reached');
  } catch (error) {
    return { answer: '', facts: {}, error: error.message, trace, elapsedMs: Date.now() - started };
  }
}

export function openAIRequest(apiKey, fetchImpl = fetch) {
  return async body => {
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
    });
    // Never save headers or raw HTTP error bodies, which can contain sensitive data.
    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}; check access, quota, model and request compatibility`);
    return response.json();
  };
}
