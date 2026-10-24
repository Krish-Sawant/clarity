import { validateRun } from './scoring.mjs';

export function checkResume(runs, savedProtocol, protocol, provider, model) {
  for (const key of ['instructions', 'outputFormat', 'toolDefinitions', 'tasks']) {
    if (JSON.stringify(savedProtocol[key]) !== JSON.stringify(protocol[key])) throw new Error(`Cannot resume: ${key} changed. Start a new run.`);
  }
  if (savedProtocol.coreVersion && savedProtocol.coreVersion !== protocol.coreVersion) throw new Error('Cannot resume: calculation or evaluation core changed. Start a new run.');
  for (const condition of ['A', 'B']) {
    const run = runs[condition];
    validateRun(run);
    if (run.condition !== condition || run.mode !== 'live' || run.provider !== provider || run.model !== model) throw new Error('Cannot resume with a different provider, model, condition or run mode.');
  }
}

export const isComplete = (run, id) => run.responses.some(r => r.caseId === id && r.answer.trim() && !r.error);

export function pacedRequest(request, delayMs, { now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  let nextStart = 0;
  return async body => {
    const wait = Math.max(0, nextStart - now());
    if (wait) await sleep(wait);
    nextStart = now() + delayMs;
    return request(body);
  };
}
