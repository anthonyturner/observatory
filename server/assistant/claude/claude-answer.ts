import { OpenRouterError } from '../open-router-error.ts';
import type { Source } from '../route-contract.ts';

export interface ClaudeAnswer {
  readonly text: string;
  readonly sources: readonly Source[];
}

const MAX_SOURCES = 5;

type Json = Readonly<Record<string, unknown>>;
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parsed(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** The pages cited, http(s) only, once each. */
function sourcesIn(value: unknown): Source[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const item of value) {
    const url = isObject(item) ? item['url'] : undefined;
    if (typeof url !== 'string' || !/^https?:\/\//.test(url) || seen.has(url)) continue;
    seen.add(url);
    const title = isObject(item) && typeof item['title'] === 'string' ? item['title'].trim() : '';
    sources.push({ title: title || new URL(url).hostname, url });
    if (sources.length >= MAX_SOURCES) break;
  }
  return sources;
}

/** The JSON object in the model's words: the whole of them, or inside a code
 *  fence or other words it added despite being asked not to. */
function answerObject(result: string): Json | null {
  const whole = parsed(result.trim());
  if (isObject(whole)) return whole;
  const start = result.indexOf('{');
  const end = result.lastIndexOf('}');
  const inner = start >= 0 && end > start ? parsed(result.slice(start, end + 1)) : null;
  return isObject(inner) ? inner : null;
}

/** What `claude -p --output-format json` printed, as Jev's words and sources.
 *  Words that are not the asked-for JSON are still the answer, with no sources. */
export function parseClaudeAnswer(output: string): ClaudeAnswer {
  const envelope = parsed(output.trim());
  if (!isObject(envelope)) throw new OpenRouterError('shape', null, 'claude -p printed no result');
  if (envelope['is_error'] === true) {
    const why =
      typeof envelope['result'] === 'string' ? envelope['result'] : String(envelope['subtype']);
    throw new OpenRouterError('upstream', null, `claude -p failed: ${why.slice(0, 160)}`);
  }
  const result = typeof envelope['result'] === 'string' ? envelope['result'] : '';
  const answer = answerObject(result);
  if (!answer) return { text: result.trim(), sources: [] };
  const text = typeof answer['text'] === 'string' ? answer['text'].trim() : '';
  return { text, sources: sourcesIn(answer['sources']) };
}
