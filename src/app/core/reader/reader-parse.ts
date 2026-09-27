import { fieldOf, isObject, isText, listOf } from '../json/json-fields';
import { ReadableBlock, ReadablePage } from './reader.types';

const KINDS: readonly ReadableBlock['kind'][] = ['heading', 'paragraph', 'item'];

const isWebUrl = (value: unknown): value is string => isText(value) && /^https?:\/\//.test(value);

function parseBlock(value: unknown): ReadableBlock | null {
  if (!isObject(value) || !isText(value['text'])) return null;
  const kind = KINDS.find((each) => each === value['kind']);
  return kind ? { kind, text: value['text'] } : null;
}

/** What `GET /api/read` returns: the page, a reason it could not be read, or
 *  null when it is neither. Only web addresses survive, for the image and the page. */
export function parseReadAnswer(body: unknown): ReadablePage | { failed: string } | null {
  if (!isObject(body)) return null;
  const failed = fieldOf(body, 'failed', isText);
  if (failed) return { failed };
  const url = fieldOf(body, 'url', isWebUrl);
  const title = fieldOf(body, 'title', isText);
  const site = fieldOf(body, 'site', isText);
  if (!url || !title || !site) return null;
  return {
    url,
    title,
    site,
    published: fieldOf(body, 'published', isText) ?? null,
    image: fieldOf(body, 'image', isWebUrl) ?? null,
    blocks: listOf(body['blocks'], parseBlock),
    canEmbed: body['canEmbed'] === true,
    isThin: body['isThin'] === true,
  };
}
