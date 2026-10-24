import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { cases } from './cases.mjs';
import { runCase, openAIRequest, instructions, outputFormat, toolDefinitions } from './model-runner.mjs';
import { scoreRun } from './scoring.mjs';
import { geminiRequest } from './gemini.mjs';
import { checkResume, isComplete, pacedRequest } from './resume.mjs';

async function main() {
  const [destination, ...extra] = process.argv.slice(2);
  const resume = extra.length === 1 && extra[0] === '--resume';
  if (!destination || (extra.length && !resume) || destination === '--help') {
    console.log('Usage: node --experimental-strip-types automate.mjs <directory> [--resume]\nEVAL_PROVIDER=openai (default): OPENAI_API_KEY and OPENAI_MODEL.\nEVAL_PROVIDER=gemini: GEMINI_API_KEY and GEMINI_MODEL. EVAL_DELAY_MS defaults to 15000 for Gemini, 0 for OpenAI. Provider quotas/billing apply.');
    return;
  }
  const provider = process.env.EVAL_PROVIDER ?? 'openai';
  if (!['openai', 'gemini'].includes(provider)) throw new Error('EVAL_PROVIDER must be openai or gemini');
  const prefix = provider === 'gemini' ? 'GEMINI' : 'OPENAI';
  const apiKey = process.env[`${prefix}_API_KEY`];
  const model = process.env[`${prefix}_MODEL`];
  if (!apiKey || !model) throw new Error(`Set ${prefix}_API_KEY and ${prefix}_MODEL locally. Do not paste your key into chat.`);
  const delayMs = Number(process.env.EVAL_DELAY_MS ?? (provider === 'gemini' ? 15000 : 0));
  if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60000) throw new Error('EVAL_DELAY_MS must be an integer from 0 to 60000');
  const directory = resolve(destination);
  // Require a new leaf directory. Never overwrite manual pilot response files.
  if (!resume) {
    await mkdir(resolve(directory, '..'), { recursive: true });
    await mkdir(directory);
    await mkdir(join(directory, 'traces'));
  }
  const hash = createHash('sha256');
  const coreHash = createHash('sha256');
  for (const path of ['../finance.ts', './cases.mjs', './model-runner.mjs', './gemini.mjs', './scoring.mjs']) coreHash.update(await readFile(new URL(path, import.meta.url)));
  const coreVersion = coreHash.digest('hex');
  hash.update(coreVersion);
  for (const path of ['./automate.mjs', './resume.mjs']) hash.update(await readFile(new URL(path, import.meta.url)));
  const version = hash.digest('hex');
  const startedAt = new Date().toISOString();
  let runs = Object.fromEntries(['A', 'B'].map(condition => [condition, {
    runId: `${startedAt}-${condition}`, condition, mode: 'live', model, provider,
    modelSettings: `${provider === 'gemini' ? 'Gemini Chat Completions compatibility API' : 'OpenAI Responses API; store=false'}; provider defaults; output token limit=4000; maxTurns=4`,
    promptVersion: 'clarity-ab-v1', appVersion: `sha256:${version}`, startedAt, responses: [],
    extractionMethod: 'Model self-reported structured facts; human consistency review pending',
  }]));
  const protocol = { instructions, outputFormat, toolDefinitions, startedAt, version, coreVersion, tasks: cases.map(c => ({ id: c.id, input: c.input, ...(c.extraPaymentCents !== undefined ? { extraPaymentCents: c.extraPaymentCents } : {}), prompt: c.prompt })) };
  if (resume) {
    runs = Object.fromEntries(await Promise.all(['A', 'B'].map(async c => [c, JSON.parse(await readFile(join(directory, `${c}.json`), 'utf8'))])));
    const savedProtocol = JSON.parse(await readFile(join(directory, 'protocol.json'), 'utf8'));
    checkResume(runs, savedProtocol, protocol, provider, model);
    // Preserve the entire previous state before editing any collected responses.
    const backup = join(directory, `resume-backup-${Date.now()}`);
    await mkdir(backup);
    for (const c of ['A', 'B']) await writeFile(join(backup, `${c}.json`), JSON.stringify(runs[c], null, 2));
    await writeFile(join(backup, 'protocol.json'), JSON.stringify(savedProtocol, null, 2));
    if (!savedProtocol.coreVersion) console.warn('Legacy run: prior source identity was not separately verifiable. This limitation is recorded in resume metadata.');
    for (const run of Object.values(runs)) {
      run.resumeHistory ??= [];
      run.resumeHistory.push({ at: startedAt, runnerVersion: version, delayMs, legacyCoreUnverified: !savedProtocol.coreVersion });
    }
    protocol.startedAt = savedProtocol.startedAt;
  }
  const save = async () => {
    for (const [condition, run] of Object.entries(runs)) {
      await writeFile(join(directory, `${condition}.json`), JSON.stringify(run, null, 2));
      await writeFile(join(directory, `${condition}.scores.json`), JSON.stringify(scoreRun(run), null, 2));
    }
  };
  await writeFile(join(directory, 'protocol.json'), JSON.stringify(protocol, null, 2));
  await save();
  const request = pacedRequest(provider === 'gemini' ? geminiRequest(apiKey) : openAIRequest(apiKey), delayMs);
  console.log(`Request spacing: ${delayMs / 1000}s. Successful cases will be skipped on resume.`);
  for (const [index, task] of cases.entries()) {
    // Alternate within each pair to reduce consistent A-first ordering.
    for (const condition of index % 2 ? ['B', 'A'] : ['A', 'B']) {
      if (isComplete(runs[condition], task.id)) continue;
      console.log(`${condition}: ${task.id}`);
      const result = await runCase({ task, condition, model, request });
      const { trace, ...response } = result;
      const traceFile = `${condition}-${task.id}-${Date.now()}.json`;
      await writeFile(join(directory, 'traces', traceFile), JSON.stringify(trace, null, 2), { flag: 'wx' });
      const responses = runs[condition].responses;
      const oldIndex = responses.findIndex(r => r.caseId === task.id);
      const entry = { caseId: task.id, ...response, traceFile, review: { reviewer: '', notes: '', unsupportedClaims: null, understanding: null, tradeoffAwareness: null, actionControl: null } };
      if (oldIndex >= 0) responses[oldIndex] = entry;
      else responses.push(entry);
      await save();
      if (result.error) {
        console.error(`Stopped after ${condition}/${task.id}: ${result.error}. Partial results saved; no retries or additional charges attempted.`);
        process.exitCode = 1;
        return;
      }
    }
  }
  for (const run of Object.values(runs)) run.completedAt = new Date().toISOString();
  await save();
  console.log(`A/B completed. Results: ${directory}. Human reviews and UI/participant studies remain pending.`);
}

main().catch(error => { console.error(error.code === 'EEXIST' ? 'Output directory already exists. Choose a new run directory to preserve previous data.' : error.message); process.exitCode = 1; });
