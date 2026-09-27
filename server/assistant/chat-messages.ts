/** One tool the model asked to run, with its arguments as the JSON text it wrote. */
export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

export type ChatMessage =
  | { readonly role: 'system' | 'user'; readonly content: string }
  | {
      readonly role: 'assistant';
      readonly content: string | null;
      readonly toolCalls?: readonly ToolCall[];
    }
  | { readonly role: 'tool'; readonly toolCallId: string; readonly content: string };

/** A JSON Schema for a tool's arguments, as the model reads it. */
export type JsonSchema = Readonly<Record<string, unknown>>;

/** A tool as the model is told of it. */
export interface ToolSpec {
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonSchema;
}

/** `none` makes the model answer in words, with no more tool calls. */
export type ToolChoice = 'auto' | 'none';

export interface ChatRequest {
  readonly messages: readonly ChatMessage[];
  readonly tools: readonly ToolSpec[];
  readonly toolChoice: ToolChoice;
}

/** What the model said in one turn: words, tool calls, or both. */
export interface ChatTurn {
  readonly text: string;
  readonly toolCalls: readonly ToolCall[];
  /** It stopped at the length cap. */
  readonly isCut: boolean;
}
