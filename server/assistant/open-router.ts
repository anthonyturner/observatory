import { isTimeout, pause } from '../util/outbound.ts';
import { keyScrubber } from '../util/key-scrub.ts';
import { chatPayload, chatTurnOf } from './chat-completion.ts';
import type { ChatRequest, ChatTurn } from './chat-messages.ts';
import { OpenRouterError, reasonOf } from './open-router-error.ts';
import { type WebAnswer, webAnswerOf } from './web-answer.ts';

/** The model one OpenRouter key pays for, as Jev's agent and as web search. */
export interface OpenRouter {
  /** False with no key: every call then fails with the reason `key`. */
  readonly isOn: boolean;
  /** How a reply names the model. */
  readonly label: string;
  /** How a reply names the model with web search. */
  readonly webLabel: string;
  /** One turn of the model's, given the conversation and the tools it may call. */
  chat(request: ChatRequest): Promise<ChatTurn>;
  /** The model with OpenRouter's web search: for anything that needs current
   *  information, such as news. Each call pays for the search too. */
  search(text: string): Promise<WebAnswer>;
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
  web: {
    path: '/chat/completions',
    label: 'Claude Haiku · web search',
    maxTokens: 450,
    // A search runs before the model answers, so it gets longer than a chat turn.
    timeoutMs: 35000,
    // OpenRouter charges for each search result on top of the model call; five keeps a lookup cheap.
    results: 5,
  },
};

const WEB_SYSTEM =
  "You answer questions on a developer's dashboard from fresh web search results. Say what is new or true now, " +
  'in plain text, in at most five short sentences or a short list, naming dates where they matter. No headings, ' +
  'no preamble, no URLs and no citation marks: the page lists the sources itself. If the results do not answer ' +
  'the question, say so in one sentence.';

/** Replaces the search's own instructions, which ask for citations named by
 *  site ("wsj.com reports…"): the page lists the sources, and the answer is read aloud. */
const WEB_SEARCH_PROMPT =
  'Web search results follow. Use them to answer, stating the facts directly. Never name, cite or link ' +
  'the websites or publications; the page lists the sources separately.';

const webPayload = (text: string) => ({
  model: OPENROUTER.chat.model,
  max_tokens: OPENROUTER.web.maxTokens,
  plugins: [{ id: 'web', max_results: OPENROUTER.web.results, search_prompt: WEB_SEARCH_PROMPT }],
  messages: [
    { role: 'system', content: WEB_SYSTEM },
    { role: 'user', content: text },
  ],
});

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
 * The one door to OpenRouter: the chat model Jev speaks through, and the same
 * model with web search. With no key
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
    webLabel: OPENROUTER.web.label,
    chat: async (request) =>
      chatTurnOf(await post(OPENROUTER.chat, chatPayload(request, OPENROUTER.chat))),
    search: async (text) =>
      webAnswerOf(await post(OPENROUTER.web, webPayload(text)), OPENROUTER.web.results),
  };
}
