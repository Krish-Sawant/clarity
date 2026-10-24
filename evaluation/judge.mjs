import { readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash, randomInt } from 'node:crypto';
import { cases } from './cases.mjs';
import { validateRun } from './scoring.mjs';
import { geminiRequest } from './gemini.mjs';
import { pacedRequest } from './resume.mjs';
import { judgeInstructions, judgeFormat, parseJudgment, summarizeReviews } from './judge-core.mjs';

async function main() {
  const [source, destination, flag] = process.argv.slice(2);
  if (!source || !destination || (flag && flag !== '--resume')) {
    console.log('Usage from evaluation folder: node --experimental-strip-types judge.mjs runs/gemini-01 runs/review-01 [--resume]\nRequires GEMINI_API_KEY and GEMINI_JUDGE_MODEL (or GEMINI_MODEL). Uses up to 12 Gemini requests.');
    return;
  }
  const model = process.env.GEMINI_JUDGE_MODEL || process.env.GEMINI_MODEL;
  if (!process.env.GEMINI_API_KEY || !model) throw new Error('Set GEMINI_API_KEY and GEMINI_JUDGE_MODEL or GEMINI_MODEL locally.');
  const delayMs = Number(process.env.EVAL_DELAY_MS ?? 15000);
  if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60000) throw new Error('Invalid EVAL_DELAY_MS (0–60000)');
  const runs = {};
  const sourceHash = createHash('sha256');
  for (const c of ['A', 'B']) {
    const text = await readFile(join(resolve(source), `${c}.json`), 'utf8');
    sourceHash.update(text); runs[c] = JSON.parse(text); validateRun(runs[c]);
    if (runs[c].condition !== c || runs[c].mode === 'fixture') throw new Error('Expected real A and B runs, not scorer fixtures');
  }
  const fingerprint = sourceHash.digest('hex');
  const protocolHash = createHash('sha256').update(judgeInstructions).update(JSON.stringify(judgeFormat)).update(JSON.stringify(cases)).digest('hex');
  const directory = resolve(destination);
  let state;
  if (flag === '--resume') {
    state = JSON.parse(await readFile(join(directory, 'review.json'), 'utf8'));
    if (state.fingerprint !== fingerprint || state.model !== model || state.protocolHash !== protocolHash) throw new Error('Source responses, judge model or protocol changed. Use a new review directory.');
  } else {
    await mkdir(resolve(directory, '..'), { recursive: true });
    await mkdir(directory); await mkdir(join(directory, 'traces'));
    const flip = randomInt(2);
    state = { label: 'AI-reviewed explanation quality — not customer testing', model, fingerprint, protocolHash,
      createdAt: new Date().toISOString(), sameModelJudge: Object.values(runs).some(r => r.model === model),
      limitations: ['Single AI judge; scores are subjective.', 'Anonymized labels do not prevent guessing a system from its wording.', 'No customer learning or UI usability has been measured.', 'A same-model judge can have self-preference bias.'],
      protocol: { instructions: judgeInstructions, format: judgeFormat, delayMs, maxOutputTokens: 6000 },
      order: Object.fromEntries(cases.map((c, i) => [c.id, (i + flip) % 2 ? ['B', 'A'] : ['A', 'B']])), results: [], skipped: [] };
  }
  const save = async () => {
    state.evidenceValidation = 'v2: exact substring, allowing removal of edge ellipsis/whitespace; original quote retained when normalized';
    state.summary = summarizeReviews(state);
    const tmp = join(directory, 'review.json.tmp');
    await writeFile(tmp, JSON.stringify(state, null, 2)); await rename(tmp, join(directory, 'review.json'));
  };
  await save();
  if (state.sameModelJudge) console.log('Using the same model family/version as an evaluated system; this bias limitation is recorded.');
  const request = pacedRequest(geminiRequest(process.env.GEMINI_API_KEY), delayMs);
  taskLoop: for (const task of cases) {
    if (state.results.some(r => r.caseId === task.id) || state.skipped.some(r => r.caseId === task.id)) continue;
    const order = state.order[task.id];
    const candidates = order.map((condition, i) => ({ candidateId: `candidate-${i + 1}`, answer: runs[condition].responses.find(r => r.caseId === task.id && !r.error)?.answer ?? '' }));
    if (candidates.some(c => !c.answer.trim())) {
      state.skipped.push({ caseId: task.id, reason: 'One or both source answers missing/failed; excluded from paired review' }); await save(); continue;
    }
    const body = { model, instructions: judgeInstructions, max_output_tokens: 6000, text: { format: judgeFormat }, input: [{ role: 'user', content: JSON.stringify({ question: task.prompt, inputs: task.input, extraPaymentCents: task.extraPaymentCents, referenceFacts: task.expected, taskGuidance: task.rubric ?? 'Explain the requested result accurately and clearly.', candidates }) }] };
    console.log(`Reviewing ${task.id}`);
    let traceFile;
    try {
      let judgment;
      // Reuse only the latest attempt with exactly the same request. Do not
      // select among historical ratings or spend quota repeating a valid result.
      const files = (await readdir(join(directory, 'traces'))).filter(f => f.startsWith(`${task.id}-`) && f.endsWith('.json')).sort();
      if (files.length) {
        const latest = files.at(-1);
        const cached = JSON.parse(await readFile(join(directory, 'traces', latest), 'utf8'));
        if (JSON.stringify(cached.request) === JSON.stringify(body)) {
          try {
            judgment = parseJudgment(cached.response, candidates);
            traceFile = latest;
            console.log('Reused saved review; no API request.');
          } catch (error) {
            if (error.code !== 'INVALID_JUDGMENT') throw error;
            state.skipped.push({ caseId: task.id, reason: 'Invalid AI review; paired scores excluded pending human review', validationError: error.message, traceFile: latest });
            delete state.lastError;
            await save();
            console.log('Saved review has invalid evidence; marked unscored and continuing without another API call.');
            continue taskLoop;
          }
        }
      }
      if (!judgment) {
        const response = await request(body);
        traceFile = `${task.id}-${Date.now()}.json`;
        await writeFile(join(directory, 'traces', traceFile), JSON.stringify({ request: body, response }, null, 2), { flag: 'wx' });
        judgment = parseJudgment(response, candidates);
      }
      state.results.push({ caseId: task.id, traceFile, reviews: judgment.reviews.map(r => ({ ...r, condition: order[candidates.findIndex(c => c.candidateId === r.candidateId)] })) });
      delete state.lastError;
      await save();
    } catch (error) {
      if (error.code === 'INVALID_JUDGMENT') {
        state.skipped.push({ caseId: task.id, reason: 'Invalid AI review; paired scores excluded pending human review', validationError: error.message, traceFile });
        delete state.lastError;
        await save();
        console.log('Invalid judge evidence/format: pair marked unscored; continuing.');
        continue;
      }
      state.lastError = { caseId: task.id, message: error.message, at: new Date().toISOString() }; await save();
      throw new Error(`Review paused: ${error.message}. Results saved; rerun with --resume.`);
    }
  }
  state.completedAt = new Date().toISOString(); await save();
  const lines = ['# AI-reviewed explanation quality', '', 'Not customer comprehension or UI testing. Single judge; exploratory results.', '', `Judge: ${model}. Same-model judge: ${state.sameModelJudge}.`, '', `Completed pairs: ${state.results.length}/${cases.length}. Skipped: ${state.skipped.length}.`, '', '| Criterion | A mean / 2 (n) | B mean / 2 (n) |', '| --- | --- | --- |'];
  for (const [criterion, a] of Object.entries(state.summary.A)) {
    const b = state.summary.B[criterion];
    const display = x => `${x.meanOutOf2 === null ? 'N/A' : x.meanOutOf2.toFixed(2)} (${x.reviewed})`;
    lines.push(`| ${criterion} | ${display(a)} | ${display(b)} |`);
  }
  lines.push('', 'Do not combine correctness and presentation into one quality score. Inspect review.json for quotes, rationale, and suggested improvements. These automated ratings require human spot-checking before use in a presentation.');
  if (state.skipped.length) {
    lines.push('', '## Unscored pairs', '', 'Both candidates are excluded together to keep comparisons paired. Missing scores are not zeros. Invalid judge output is a review failure, not a failure of the evaluated bot.', '');
    for (const skipped of state.skipped) lines.push(`- ${skipped.caseId}: ${skipped.reason}`);
  }
  await writeFile(join(directory, 'SUMMARY.md'), lines.join('\n'));
  console.log(`Review complete: ${join(directory, 'SUMMARY.md')}`);
}
main().catch(error => { console.error(error.code === 'EEXIST' ? 'Review directory exists; use --resume or a new directory.' : error.message); process.exitCode = 1; });
