import type { Values } from "../sim/scenarios.ts";
import type { TableRowKey } from "../sim/summary.ts";

// Mirrors LLM function calling: the agent replies with text and/or tool calls,
// the browser runs the tools and appends their results, and the agent goes again.

export type ToolCall = { id: string; name: string; args: Record<string, unknown> };

export type ChatItem =
  | { role: "user"; text: string }
  | { role: "assistant"; text?: string; toolCalls?: ToolCall[] }
  | { role: "tool"; callId: string; name: string; result: unknown };

export type Session = { scenarioId: string | null; values: Values; years: number };

// Frozen copy of the inputs, so a chart drawn earlier doesn't change when later turns edit inputs.
export type Snapshot = { scenarioId: string; values: Values; years: number };

export type ChartMetric = "netWorth" | "cash" | "debt";

export type Block =
  | { type: "question"; text: string; choices: string[] }
  | { type: "chart"; snapshot: Snapshot; metric: ChartMetric; title?: string }
  | { type: "table"; snapshot: Snapshot; rows: TableRowKey[] }
  | { type: "playground"; snapshot: Snapshot }
  | { type: "message"; lines: string[] };

export type AgentTurn = { text?: string; toolCalls?: ToolCall[] };

// The scripted agent reads the session directly; the real one will learn it from tool results.
export type Agent = (history: ChatItem[], session: Session) => Promise<AgentTurn>;
