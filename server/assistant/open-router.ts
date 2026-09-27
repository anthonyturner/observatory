import { isTimeout, pause } from '../util/outbound.ts';
import { keyScrubber } from '../util/key-scrub.ts';
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

/** A page a web answer drew on. */
export interface WebSource {
  readonly title: string;
  readonly url: string;
}

/** An answer from the web, with the pages it drew on. */
export interface WebAnswer extends QuickAnswer {
  readonly sources: readonly WebSource[];
}

/** The two models one OpenRouter key pays for. */
export interface OpenRouter {
  /** False with no key: every call then fails with the reason `key`. */
  readonly isOn: boolean;
  /** How a reply names the quick-answer model. */
  readonly quickLabel: string;
  /** How a reply names the model with web search. */
  readonly webLabel: string;
  /** Jev's answers to `questions` about `state`. */
  decide(state: Readonly<Record<string, unknown>>, questions: JevQuestions): Promise<JevAnswers>;
  answer(text: string): Promise<QuickAnswer>;
  /** The quick model with OpenRouter's web search: for anything that needs
   *  current information, such as news. Each call pays for the search too. */
  search(text: string): Promise<WebAnswer>;
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
  web: {
    path: '/chat/completions',
    label: 'Claude Haiku · web search',
    maxTokens: 450,
    // A search runs before the model answers, so it gets longer than a quick answer.
    timeoutMs: 35000,
    // OpenRouter charges for each search result on top of the model call; five keeps a lookup cheap.
    results: 5,
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

/** URLs, markdown links, bold, headings and citation marks the model left in
 *  despite being asked not to: the page lists sources itself, shows plain
 *  text, and reads the answer aloud. */
function withoutCitations(text: string): string {
  return (
    text
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '$1')
      .replace(/\(\s*\[?\d+\]?(?:\s*,\s*\[?\d+\]?)*\s*\)/g, '')
      .replace(/\[\d+\]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      // Web search has the model cite a page by its bare site name ("wsj.com").
      .replace(
        /(?<![\w@/.-])(?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|dev|co|news|gov|edu|app|tech|info)(?:\.[a-z]{2})?(?![\w/-])/gi,
        '',
      )
      // The page shows plain text and reads it aloud: no bold, no headings.
      .replace(/\*\*([^*\n]+)\*\*/g, '$1')
      .replace(/^#{1,6}[ \t]+/gm, '')
      .replace(/[ \t]+([.,;:!?])/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/^([-*]) +/gm, '$1 ')
      .replace(/[ \t]+$/gm, '')
      .trim()
  );
}

/** The pages cited, in order, once each, http(s) only. */
function sourcesOf(body: unknown, most: number): WebSource[] {
  const choices = isObject(body) ? body['choices'] : undefined;
  const choice: unknown = Array.isArray(choices) ? choices[0] : undefined;
  const message = isObject(choice) ? choice['message'] : undefined;
  const annotations = isObject(message) ? message['annotations'] : undefined;
  if (!Array.isArray(annotations)) return [];
  const seen = new Set<string>();
  const sources: WebSource[] = [];
  for (const annotation of annotations) {
    const citation = isObject(annotation) ? annotation['url_citation'] : undefined;
    const url = isObject(citation) ? citation['url'] : undefined;
    if (typeof url !== 'string' || !/^https?:\/\//.test(url) || seen.has(url)) continue;
    seen.add(url);
    const title =
      isObject(citation) && typeof citation['title'] === 'string' ? citation['title'].trim() : '';
    sources.push({ title: title || new URL(url).hostname, url });
    if (sources.length >= most) break;
  }
  return sources;
}

function webAnswerOf(body: unknown, most: number): WebAnswer {
  const answer = quickAnswerOf(body);
  return { ...answer, text: withoutCitations(answer.text), sources: sourcesOf(body, most) };
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
    search: async (text) =>
      webAnswerOf(
        await post(OPENROUTER.web, {
          model: OPENROUTER.quick.model,
          max_tokens: OPENROUTER.web.maxTokens,
          plugins: [
            { id: 'web', max_results: OPENROUTER.web.results, search_prompt: WEB_SEARCH_PROMPT },
          ],
          messages: [
            { role: 'system', content: WEB_SYSTEM },
            { role: 'user', content: text },
          ],
        }),
        OPENROUTER.web.results,
      ),
    webLabel: OPENROUTER.web.label,
  };
}
