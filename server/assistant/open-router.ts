import { keyScrubber } from './key-scrub.ts';
import { OpenRouterError, reasonOf } from './open-router-error.ts';

/** One question Jev answers by choosing among `criteria`, keyed by the answer. */
export interface JevQuestion {
  readonly type: 'choice';
  readonly instructions: string;
  readonly criteria: Readonly<Record<string, string>>;
}

export type JevQuestions = Readonly<Record<string, JevQuestion>>;

/** One of Jev's answers, as it gave it: checked where it is read. */
export interface JevAnswer {
  readonly choice?: unknown;
  readonly probabilities?: unknown;
  readonly confidence?: unknown;
}

export type JevAnswers = Readonly<Record<string, JevAnswer | undefined>>;

/** A quick answer, and whether it was cut off at the length cap. */
export interface QuickAnswer {
  readonly text: string;
  readonly isCut: boolean;
}

/** The two models one OpenRouter key pays for. */
export interface OpenRouter {
  /** False with no key: every call then fails with the reason `key`. */
  readonly isOn: boolean;
  /** How a reply names the quick-answer model. */
  readonly quickLabel: string;
  /** Jev's answers to `questions` about `state`. */
  decide(state: Readonly<Record<string, unknown>>, questions: JevQuestions): Promise<JevAnswers>;
  answer(text: string): Promise<QuickAnswer>;
}

interface Endpoint {
  readonly path: string;
  readonly timeoutMs: number;
}

/**
 * Where and what to call. Jev's id resolves on OpenRouter (its endpoints list
 * names TypeSafe as the provider, checked 2026-09-25) though the general model
 * list leaves it out, so its id may need to change here.
 */
const OPENROUTER = {
  base: 'https://openrouter.ai/api/v1',
  jev: { path: '/systemone', model: 'typesafe/jev-1.13', timeoutMs: 8000 },
  quick: {
    path: '/chat/completions',
    model: 'anthropic/claude-haiku-4.5',
    label: 'Claude Haiku',
    maxTokens: 300,
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

const QUICK_SYSTEM =
  "You give quick answers on a developer's dashboard. Answer in plain text, in at most four short " +
  'sentences or a short list. Put code in `backticks`. No headings and no preamble. If the question needs the ' +
  "developer's own files, code or commands run on their machine, say in one sentence that it needs a Claude Code " +
  'task instead.';

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const isTimeout = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

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

function answersOf(body: unknown): JevAnswers {
  const answers = isObject(body) ? body['answers'] : undefined;
  if (!isObject(answers)) throw new OpenRouterError('shape', 200, 'no answers');
  return answers as JevAnswers;
}

function quickAnswerOf(body: unknown): QuickAnswer {
  const choices = isObject(body) ? body['choices'] : undefined;
  const choice: unknown = Array.isArray(choices) ? choices[0] : undefined;
  const message = isObject(choice) ? choice['message'] : undefined;
  const text = isObject(message) ? message['content'] : undefined;
  if (typeof text !== 'string' || !text.trim()) throw new OpenRouterError('shape', 200, 'no text');
  return { text: text.trim(), isCut: isObject(choice) && choice['finish_reason'] === 'length' };
}

/**
 * The one door to OpenRouter: Jev, which sorts a request by the effort it
 * needs, and the quick-answer model. With no key it still builds, `isOn` is
 * false and every call fails with the reason `key`, so a site without one
 * starts and says so.
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
    quickLabel: OPENROUTER.quick.label,
    decide: async (state, questions) =>
      answersOf(await post(OPENROUTER.jev, { state, model: OPENROUTER.jev.model, questions })),
    answer: async (text) =>
      quickAnswerOf(
        await post(OPENROUTER.quick, {
          model: OPENROUTER.quick.model,
          max_tokens: OPENROUTER.quick.maxTokens,
          messages: [
            { role: 'system', content: QUICK_SYSTEM },
            { role: 'user', content: text },
          ],
        }),
      ),
  };
}
