// Retrieval over the prebuilt index (scripts/build-rag-index.mjs → rag-index.json).
import index from "./rag-index.json";
import { embedQuery } from "./gemini";

export type Passage = { id: string; source_id: string; title: string; url: string; publisher: string; kind: string; text: string; score: number };

type IndexedChunk = Omit<Passage, "score"> & { scenario_ids: string[]; embedding: number[] };
const chunks = index.chunks as IndexedChunk[];

// Below this similarity a passage is treated as off-topic (gemini-embedding-001, 768 dims).
// Measured on this index: clear matches score 0.66–0.79, off-topic questions top out near 0.55.
export const MIN_SCORE = 0.6;
// Passages written for the decision being simulated get a small nudge, never a guarantee.
const SCENARIO_BOOST = 0.03;

export async function retrieve(query: string, scenarioId: string | null, k = 5): Promise<Passage[]> {
  const q = await embedQuery(query, index.model, index.dimensions);
  const ranked = chunks
    .map((c) => {
      let dot = 0;
      for (let i = 0; i < q.length; i++) dot += q[i] * c.embedding[i];
      return { c, score: dot + (scenarioId && c.scenario_ids.includes(scenarioId) ? SCENARIO_BOOST : 0) };
    })
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  // At most two chunks per source, so one long guide can't crowd out the rest.
  const perSource = new Map<string, number>();
  const picked: Passage[] = [];
  for (const { c, score } of ranked) {
    const n = perSource.get(c.source_id) ?? 0;
    if (n >= 2) continue;
    perSource.set(c.source_id, n + 1);
    picked.push({ id: c.id, source_id: c.source_id, title: c.title, url: c.url, publisher: c.publisher, kind: c.kind, text: c.text, score: Number(score.toFixed(3)) });
    if (picked.length === k) break;
  }
  return picked;
}
