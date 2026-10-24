import { runTool } from "./tools.ts";
import type { Agent, Block, ChatItem, Session, ToolCall } from "./types.ts";

export type LoopEvent =
  | { kind: "assistant"; text: string }
  | { kind: "block"; block: Block }
  | { kind: "tool"; call: ToolCall; result: unknown };

const MAX_TURNS = 8;

// One user message: let the agent act (possibly several turns of tool calls)
// until it asks the user something or stops calling tools.
export async function runAgentLoop(
  agent: Agent,
  history: ChatItem[],
  session: Session,
  onEvent: (e: LoopEvent) => void,
): Promise<{ history: ChatItem[]; session: Session }> {
  let items = history;
  let sess = session;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const reply = await agent(items, sess);
    const calls = reply.toolCalls ?? [];
    if (!reply.text && !calls.length) break;
    items = [...items, { role: "assistant", text: reply.text, toolCalls: calls }];
    if (reply.text) onEvent({ kind: "assistant", text: reply.text });

    let waitForUser = false;
    for (const call of calls) {
      const out = runTool(call, sess);
      sess = out.session;
      items = [...items, { role: "tool", callId: call.id, name: call.name, result: out.result }];
      onEvent({ kind: "tool", call, result: out.result });
      if (out.block) onEvent({ kind: "block", block: out.block });
      waitForUser ||= Boolean(out.waitForUser);
    }
    if (waitForUser || !calls.length) break;
  }
  return { history: items, session: sess };
}
