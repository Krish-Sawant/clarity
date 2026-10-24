"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { runAgentLoop, type LoopEvent } from "@/lib/chat/loop";
import { mockAgent } from "@/lib/chat/mockAgent";
import { EMPTY_SESSION, scenarioById, simulate } from "@/lib/chat/tools";
import type { Block, ChartMetric, ChatItem, Session, Snapshot } from "@/lib/chat/types";
import { futureYouMessage } from "@/lib/sim/message";
import type { Values } from "@/lib/sim/scenarios";
import type { TableRowKey } from "@/lib/sim/summary";
import {
  Assumptions, FutureYouCard, ResultChart, ScenarioControls, SummaryTable, YearsSlider, applyField,
} from "@/components/sim";

// Swap for the backend-backed agent once /v1/chat exists; nothing else changes.
const agent = mockAgent;

type Entry = { id: number } & ({ kind: "user"; text: string } | LoopEvent);

export default function Chat() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [showTools, setShowTools] = useState(false);
  const historyRef = useRef<ChatItem[]>([]);
  const sessionRef = useRef<Session>(EMPTY_SESSION);
  const idRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length]);

  const push = (e: { kind: "user"; text: string } | LoopEvent) =>
    setEntries((prev) => [...prev, { ...e, id: ++idRef.current }]);

  async function send(text: string) {
    if (busy || !text.trim()) return;
    setInput("");
    setBusy(true);
    push({ kind: "user", text });
    try {
      const out = await runAgentLoop(agent, [...historyRef.current, { role: "user", text }], sessionRef.current, push);
      historyRef.current = out.history;
      sessionRef.current = out.session;
    } catch (err) {
      push({ kind: "assistant", text: `Something went wrong: ${String(err)}` });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    historyRef.current = [];
    sessionRef.current = EMPTY_SESSION;
    setEntries([]);
  }

  // Choice buttons only work on the latest question, until the user answers it.
  const lastUserIdx = entries.findLastIndex((e) => e.kind === "user");
  const activeQuestionIdx = entries.findLastIndex((e) => e.kind === "block" && e.block.type === "question");
  const questionActive = !busy && activeQuestionIdx > lastUserIdx;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-[var(--background)] py-3 dark:border-zinc-800">
        <div>
          <h1 className="text-lg font-semibold">Future Decision</h1>
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Demo mode: scripted assistant, no AI yet
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-1 text-zinc-500">
            <input type="checkbox" checked={showTools} onChange={(e) => setShowTools(e.target.checked)} />
            Show tool calls
          </label>
          <button onClick={reset} className="rounded bg-zinc-200 px-2 py-1 dark:bg-zinc-800">
            New chat
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-4 py-6">
        {entries.length === 0 && (
          <p className="py-16 text-center text-lg font-medium">What money decision are you weighing?</p>
        )}
        {entries.map((e, i) => {
          if (e.kind === "user") {
            return (
              <div key={e.id} className="flex justify-end">
                <p className="max-w-[80%] rounded-2xl bg-blue-600 px-4 py-2 text-white">{e.text}</p>
              </div>
            );
          }
          if (e.kind === "assistant") return <p key={e.id} className="max-w-[90%]">{e.text}</p>;
          if (e.kind === "tool") {
            return showTools ? <ToolLine key={e.id} name={e.call.name} args={e.call.args} result={e.result} /> : null;
          }
          return <BlockView key={e.id} block={e.block} active={questionActive && i === activeQuestionIdx} onChoose={send} />;
        })}
        {busy && <p className="animate-pulse text-sm text-zinc-500">Thinking…</p>}
        <div ref={bottomRef} />
      </main>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-0 flex gap-2 border-t border-zinc-200 bg-[var(--background)] py-3 dark:border-zinc-800"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={entries.length ? "Answer, or ask a what-if…" : "Ask about a money decision…"}
          className="flex-1 rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          aria-label="Message"
        />
        <button type="submit" disabled={busy || !input.trim()} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}

function ToolLine({ name, args, result }: { name: string; args: unknown; result: unknown }) {
  const short = (x: unknown) => {
    const s = JSON.stringify(x);
    return s.length > 160 ? `${s.slice(0, 160)}…` : s;
  };
  return (
    <details className="font-mono text-xs text-zinc-500">
      <summary className="cursor-pointer">
        🔧 {name}({short(args)})
      </summary>
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-zinc-100 p-2 dark:bg-zinc-900">{JSON.stringify(result, null, 2)}</pre>
    </details>
  );
}

/* ---------- Blocks ---------- */

function BlockView({ block, active, onChoose }: { block: Block; active: boolean; onChoose: (text: string) => void }) {
  switch (block.type) {
    case "question":
      return (
        <div className="space-y-2">
          <p className="font-medium">{block.text}</p>
          <div className="flex flex-wrap gap-2">
            {block.choices.map((c) => (
              <button
                key={c}
                disabled={!active}
                onClick={() => onChoose(c)}
                className="rounded-full border border-blue-600 px-3 py-1 text-left text-sm text-blue-700 hover:bg-blue-50 disabled:border-zinc-300 disabled:text-zinc-400 disabled:hover:bg-transparent dark:text-blue-400 dark:hover:bg-blue-950"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      );
    case "chart":
      return <ChartBlock snapshot={block.snapshot} metric={block.metric} title={block.title} />;
    case "table":
      return <TableBlock snapshot={block.snapshot} rows={block.rows} />;
    case "playground":
      return <PlaygroundBlock snapshot={block.snapshot} />;
    case "message":
      return <FutureYouCard lines={block.lines} />;
  }
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">{children}</div>;
}

function ChartBlock({ snapshot, metric, title }: { snapshot: Snapshot; metric: ChartMetric; title?: string }) {
  const { comparison, months } = useMemo(() => simulate(snapshot), [snapshot]);
  return (
    <Card>
      <ResultChart result={comparison} months={months} metric={metric} title={title} />
    </Card>
  );
}

function TableBlock({ snapshot, rows }: { snapshot: Snapshot; rows: TableRowKey[] }) {
  const { comparison, months } = useMemo(() => simulate(snapshot), [snapshot]);
  return (
    <Card>
      <SummaryTable result={comparison} months={months} rows={rows} />
    </Card>
  );
}

// Live copy of the scenario: slider changes here redraw instantly but don't
// change what the assistant knows (what-ifs build on the chat's inputs).
function PlaygroundBlock({ snapshot }: { snapshot: Snapshot }) {
  const scenario = scenarioById(snapshot.scenarioId)!;
  const [values, setValues] = useState<Values>(snapshot.values);
  const [years, setYears] = useState(snapshot.years);
  const { comparison, months } = useMemo(
    () => simulate({ scenarioId: snapshot.scenarioId, values, years }),
    [snapshot.scenarioId, values, years],
  );
  const edited = values !== snapshot.values || years !== snapshot.years;

  return (
    <Card>
      <ResultChart result={comparison} months={months} />
      <details className="mt-3" open>
        <summary className="cursor-pointer text-sm font-medium">Adjust assumptions</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <ScenarioControls scenario={scenario} values={values} onChange={(k, v) => setValues((prev) => applyField(scenario, prev, k, v))} />
          <YearsSlider years={years} onChange={setYears} />
        </div>
      </details>
      {edited && (
        <div className="mt-4">
          <FutureYouCard lines={futureYouMessage(comparison, months)} note="Updated live for your slider changes." />
          <button
            onClick={() => {
              setValues(snapshot.values);
              setYears(snapshot.years);
            }}
            className="mt-2 rounded bg-zinc-200 px-3 py-1 text-sm dark:bg-zinc-800"
          >
            Reset sliders
          </button>
        </div>
      )}
      <div className="mt-3">
        <Assumptions scenario={scenario} />
      </div>
    </Card>
  );
}
