import type { JsonSchema } from '../chat-messages.ts';
import type { ActionReply, Project, Proposal, QueueAct, Source } from '../route-contract.ts';

/** A tool's arguments, as the model wrote them: each tool checks its own. */
export type ToolArgs = Readonly<Record<string, unknown>>;

/** What a tool may know of the request it serves. */
export interface ToolContext {
  /** The projects a request can name, each with its star map. */
  readonly projects: readonly Project[];
}

/** What a tool chose for the reply: a page to open or an op, a proposal, or
 *  a Review Queue command. */
export type AgentEffect =
  | { readonly kind: 'action'; readonly reply: ActionReply }
  | { readonly kind: 'proposal'; readonly proposal: Proposal }
  | { readonly kind: 'queue'; readonly act: QueueAct };

export interface ToolResult {
  /** What the model reads back: kept small, since every token is paid for. */
  readonly content: unknown;
  readonly effect?: AgentEffect;
  /** Pages the content came from, for the reply to link. */
  readonly sources?: readonly Source[];
}

/** One thing Jev can look up or do. A new tool is one more implementation in
 *  the list the agent is given; nothing else changes. */
export interface AgentTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonSchema;
  run(args: ToolArgs, context: ToolContext): Promise<ToolResult>;
}
