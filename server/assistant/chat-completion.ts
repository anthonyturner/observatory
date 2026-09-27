import type { ChatMessage, ChatRequest, ChatTurn, ToolCall } from './chat-messages.ts';
import { OpenRouterError } from './open-router-error.ts';

/** The model and its length cap, as the chat-completions body names them. */
export interface ChatModel {
  readonly model: string;
  readonly maxTokens: number;
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

function wireMessage(message: ChatMessage): Readonly<Record<string, unknown>> {
  if (message.role === 'tool') {
    return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
  }
  if (message.role !== 'assistant' || !message.toolCalls?.length) return message;
  return {
    role: 'assistant',
    content: message.content,
    tool_calls: message.toolCalls.map((call) => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: call.arguments },
    })),
  };
}

/** The OpenAI-style chat-completions body OpenRouter takes. */
export function chatPayload(request: ChatRequest, chat: ChatModel): unknown {
  return {
    model: chat.model,
    max_tokens: chat.maxTokens,
    messages: request.messages.map(wireMessage),
    tools: request.tools.map((tool) => ({ type: 'function', function: tool })),
    tool_choice: request.toolChoice,
  };
}

function toolCallOf(value: unknown): ToolCall | null {
  const called = isObject(value) ? value['function'] : undefined;
  if (!isObject(value) || !isObject(called)) return null;
  const { id } = value;
  const { name, arguments: args } = called;
  if (typeof id !== 'string' || typeof name !== 'string') return null;
  return { id, name, arguments: typeof args === 'string' ? args : '{}' };
}

/** One turn of the model's, read from a chat-completions answer. */
export function chatTurnOf(body: unknown): ChatTurn {
  const choices = isObject(body) ? body['choices'] : undefined;
  const choice: unknown = Array.isArray(choices) ? choices[0] : undefined;
  const message = isObject(choice) ? choice['message'] : undefined;
  if (!isObject(message)) throw new OpenRouterError('shape', 200, 'no message');
  const text = typeof message['content'] === 'string' ? message['content'].trim() : '';
  const calls = Array.isArray(message['tool_calls']) ? message['tool_calls'] : [];
  return {
    text,
    toolCalls: calls.map(toolCallOf).filter((call) => call !== null),
    isCut: isObject(choice) && choice['finish_reason'] === 'length',
  };
}
