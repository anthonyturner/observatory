import { chatTurnOf } from './chat-completion.ts';
import type { Source } from './route-contract.ts';

/** An answer from the web, with the pages it drew on. */
export interface WebAnswer {
  readonly text: string;
  readonly isCut: boolean;
  readonly sources: readonly Source[];
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

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
function sourcesOf(body: unknown, most: number): Source[] {
  const choices = isObject(body) ? body['choices'] : undefined;
  const choice: unknown = Array.isArray(choices) ? choices[0] : undefined;
  const message = isObject(choice) ? choice['message'] : undefined;
  const annotations = isObject(message) ? message['annotations'] : undefined;
  if (!Array.isArray(annotations)) return [];
  const seen = new Set<string>();
  const sources: Source[] = [];
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

/** A web-search answer, read from a chat-completions answer: plain words, and
 *  at most `most` of the pages it cited. */
export function webAnswerOf(body: unknown, most: number): WebAnswer {
  const { text, isCut } = chatTurnOf(body);
  return { text: withoutCitations(text), isCut, sources: sourcesOf(body, most) };
}
