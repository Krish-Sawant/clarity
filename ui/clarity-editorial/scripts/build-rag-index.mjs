// Builds src/server/rag-index.json from the curated source list.
// Usage (from ui/clarity-editorial): npm run rag:index   (needs GEMINI_API_KEY in .env.local)
//
// Each page is fetched, reduced to its <main> article text, split into ~220-word
// chunks and embedded with Gemini. Re-run whenever rag_sources.json changes.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCES = path.resolve(here, "../../../BackEnd/api/app/fixtures/rag_sources.json");
const OUT = path.resolve(here, "../src/server/rag-index.json");
const MODEL = "gemini-embedding-001";
const DIMENSIONS = 768;
const CHUNK_WORDS = 220;
const MIN_CHUNK_WORDS = 40;
const BATCH = 20; // each text counts toward the free tier's per-minute quota

const key = process.env.GEMINI_API_KEY;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…" };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m);

// Page chrome that survives inside <main> on CFPB pages.
const BOILERPLATE = [/^last reviewed:/i, /^don.t see what you.re looking for/i, /^browse related questions/i, /^tell us about your experience/i, /^an official website of/i, /^share this/i, /^was this page helpful/i, /^page last (modified|reviewed)/i];

export function articleBlocks(html) {
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? html;
  const text = main
    .replace(/<(script|style|noscript|nav|aside|footer|form|svg|button)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|li|h[1-6]|div|section|tr|dd|dt|blockquote)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const blocks = [];
  for (const raw of decode(text).split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.split(" ").length < 4) continue;
    if (BOILERPLATE.some((re) => re.test(line))) {
      if (/looking for|related questions/i.test(line)) break; // the rest is navigation
      continue;
    }
    if (blocks.at(-1) !== line) blocks.push(line);
  }
  return blocks;
}

export function chunk(blocks) {
  const chunks = [];
  let current = [];
  let words = 0;
  for (const block of blocks) {
    const n = block.split(" ").length;
    if (words && words + n > CHUNK_WORDS) {
      chunks.push(current.join("\n"));
      current = [current.at(-1)]; // one block of overlap keeps context across the cut
      words = current[0].split(" ").length;
    }
    current.push(block);
    words += n;
  }
  if (words >= MIN_CHUNK_WORDS || !chunks.length) chunks.push(current.join("\n"));
  return chunks;
}

async function embedBatch(items, attempt = 0) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: items.map((c) => ({
        model: `models/${MODEL}`,
        content: { parts: [{ text: c.text }] },
        taskType: "RETRIEVAL_DOCUMENT",
        title: c.title,
        outputDimensionality: DIMENSIONS,
      })),
    }),
  });
  if (res.status === 429 && attempt < 6) {
    // Free-tier per-minute quota: wait as long as Google asks (RetryInfo), else back off.
    const body = await res.json().catch(() => ({}));
    const hint = body.error?.details?.find((d) => d.retryDelay)?.retryDelay;
    const seconds = hint ? Math.ceil(parseFloat(hint)) + 1 : 15 * (attempt + 1);
    console.log(`rate limited; waiting ${seconds}s`);
    await new Promise((r) => setTimeout(r, seconds * 1000));
    return embedBatch(items, attempt + 1);
  }
  if (!res.ok) throw new Error(`Embedding failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const { embeddings } = await res.json();
  return embeddings.map((e) => {
    // Truncated Gemini embeddings are not unit length; normalize so retrieval can use a dot product.
    const norm = Math.hypot(...e.values);
    return e.values.map((v) => Number((v / norm).toFixed(5)));
  });
}

async function main() {
  if (!key) throw new Error("Set GEMINI_API_KEY in ui/clarity-editorial/.env.local first.");
  const { sources } = JSON.parse(await readFile(SOURCES, "utf8"));
  const chunks = [];
  const failed = [];
  for (const s of sources) {
    const res = await fetch(s.url, { headers: { "User-Agent": "Mozilla/5.0 (Clarity source indexer)" } });
    const blocks = res.ok ? articleBlocks(await res.text()) : [];
    if (!blocks.length) {
      failed.push(`${s.source_id}: HTTP ${res.status}, ${blocks.length} text blocks`);
      continue;
    }
    chunk(blocks).forEach((text, i) => chunks.push({
      id: `${s.source_id}#${i}`, source_id: s.source_id, title: s.title, url: s.url, publisher: s.publisher,
      kind: s.kind, scenario_ids: s.scenario_ids, text,
    }));
    process.stdout.write(".");
  }
  console.log(`\n${chunks.length} chunks from ${sources.length - failed.length}/${sources.length} sources`);

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vectors = await embedBatch(batch);
    batch.forEach((c, j) => { c.embedding = vectors[j]; });
    console.log(`embedded ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
  }

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT,JSON.stringify({ model: MODEL, dimensions: DIMENSIONS, built_at: new Date().toISOString(), chunks }) + "\n");
  console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
  if (failed.length) console.log(`skipped:\n  ${failed.join("\n  ")}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
