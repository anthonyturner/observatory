import { isTimeout, pause } from '../util/outbound.ts';
import { keyScrubber } from '../util/key-scrub.ts';
import { chatPayload, chatTurnOf } from './chat-completion.ts';
import type { ChatRequest, ChatTurn } from './chat-messages.ts';
import { OpenRouterError, reasonOf } from './open-router-error.ts';

/** The model one OpenRouter key pays for. */
export interface OpenRouter {
  /** False with no key: every call then fails with the reason `key`. */
  readonly isOn: boolean;
  /** How a reply names the model. */
  readonly label: string;
  /** One turn of the model's, given the conversation and the tools it may call. */
  chat(request: ChatRequest): Promise<ChatTurn>;
}

interface Endpoint {
  readonly path: string;
  readonly timeoutMs: number;
}

/** Where and what to call. */
const OPENROUTER = {
  base: 'https://openrouter.ai/api/v1',
  chat: {
    path: '/chat/completions',
    model: 'anthropic/claude-haiku-4.5',
    label: 'Claude Haiku',
    maxTokens: 800,
    timeoutMs: 20000,
  },
};

export interface OpenRouterOptions {
  /** A paid credential: it goes into the Authorization header and nowhere else. */
  readonly key: string | null;
  readonly fetch?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
}

/** Rate limits and overload are worth a second try; each wait is capped so
 *  both retries together stay near three seconds, since someone is waiting. */
const RETRY_ON = new Set([429, 529]);
const RETRY_MS = [600, 1500];
const MAX_WAIT_MS = 1500;
const MS_PER_SECOND = 1000;
const MAX_DETAIL_LENGTH = 160;
const APP_TITLE = 'Observatory';

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

/** The wait before retry number `attempt`: OpenRouter's own `retry-after` when it gives one. */
function waitBefore(response: Response, attempt: number): number {
  const after = Number(response.headers.get('retry-after'));
  return Math.min(after > 0 ? after * MS_PER_SECOND : RETRY_MS[attempt], MAX_WAIT_MS);
}

/** The body of a successful answer; the time limit covers it too, and can run out part way. */
async function bodyOf(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new OpenRouterError(isTimeout(error) ? 'timeout' : 'shape', response.status);
  }
}

/**
 * The one door to OpenRouter: the chat model Jev speaks through. With no key
 * it still builds, `isOn` is false and every call fails with the reason
 * `key`, so a site without one starts and says so.
 */
export function openRouter(options: OpenRouterOptions): OpenRouter {
  const { key, fetch: send = fetch, sleep = pause } = options;
  const scrub = keyScrubber(key);

  /** One line of OpenRouter's own complaint, for the server's log. */
  const detailOf = (said: string): string => {
    let message: unknown = '';
    try {
      const body: unknown = JSON.parse(said);
      const error = isObject(body) ? body['error'] : undefined;
      message = isObject(error) ? (error['message'] ?? '') : '';
    } catch {
      message = '';
    }
    return scrub(message).split('\n')[0].slice(0, MAX_DETAIL_LENGTH);
  };

  async function sendOnce(endpoint: Endpoint, apiKey: string, payload: unknown) {
    try {
      return await send(OPENROUTER.base + endpoint.path, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'x-title': APP_TITLE,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(endpoint.timeoutMs),
      });
    } catch (error) {
      if (isTimeout(error)) throw new OpenRouterError('timeout', null);
      const said = error instanceof Error ? error.message : String(error);
      throw new OpenRouterError('network', null, scrub(said).slice(0, MAX_DETAIL_LENGTH));
    }
  }

  async function post(endpoint: Endpoint, payload: unknown): Promise<unknown> {
    if (!key) throw new OpenRouterError('key', null, 'no key set');
    for (let attempt = 0; ; attempt++) {
      const response = await sendOnce(endpoint, key, payload);
      if (response.ok) return bodyOf(response);
      const said = await response.text().catch(() => '');
      if (!RETRY_ON.has(response.status) || attempt >= RETRY_MS.length) {
        throw new OpenRouterError(reasonOf(response.status), response.status, detailOf(said));
      }
      await sleep(waitBefore(response, attempt));
    }
  }

  return {
    isOn: Boolean(key),
    label: OPENROUTER.chat.label,
    chat: async (request) =>
      chatTurnOf(await post(OPENROUTER.chat, chatPayload(request, OPENROUTER.chat))),
  };
}
