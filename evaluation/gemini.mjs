// Gemini's documented OpenAI-compatible Chat Completions endpoint.
// Preserve complete assistant tool-call messages, including thought signatures.
export function geminiRequest(apiKey, fetchImpl = fetch) {
  return async body => {
    const messages = [{ role: 'system', content: body.instructions }];
    for (const item of body.input) {
      if (item.geminiMessage) messages.push(item.geminiMessage);
      else if (item.type === 'function_call_output') messages.push({ role: 'tool', tool_call_id: item.call_id, content: item.output });
      else if (item.role === 'user') messages.push(item);
      else if (item.type !== 'function_call') throw new Error('Unsupported Gemini conversation item');
    }
    const { type, ...schema } = body.text.format;
    const payload = {
      model: body.model, messages, max_tokens: body.max_output_tokens,
      response_format: { type: 'json_schema', json_schema: schema },
      ...(body.tools ? { tools: body.tools.map(({ type, ...fn }) => ({ type, function: fn })), tool_choice: 'auto' } : {}),
    };
    const response = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`Gemini HTTP ${response.status}; check model compatibility, key and quota. No automatic retries.`);
    const raw = await response.json();
    const choice = raw.choices?.[0];
    const message = choice?.message;
    if (!message || !['stop', 'tool_calls'].includes(choice.finish_reason)) return { status: 'incomplete', output: [], raw, providerRequest: payload };
    const calls = message.tool_calls ?? [];
    if (calls.some(c => !c.id || c.type !== 'function')) throw new Error('Gemini returned an unsupported tool call or missing call ID');
    const output = calls.length
      ? calls.map((c, i) => ({ type: 'function_call', name: c.function.name, arguments: c.function.arguments, call_id: c.id, ...(i === 0 ? { geminiMessage: message } : {}) }))
      : [{ type: 'message', content: message.refusal ? [{ type: 'refusal', refusal: message.refusal }] : [{ type: 'output_text', text: message.content ?? '' }] }];
    return { status: 'completed', output, raw, providerRequest: payload };
  };
}
