import { fieldOf, isObject, isText, listOf } from '../json/json-fields';
import { NewsItem, NewsReport } from './news.types';

const isWebUrl = (value: unknown): value is string => isText(value) && /^https?:\/\//i.test(value);

function parseItem(value: unknown): NewsItem | null {
  if (!isObject(value)) return null;
  const title = fieldOf(value, 'title', isText);
  const url = fieldOf(value, 'url', isWebUrl);
  const source = fieldOf(value, 'source', isText);
  if (!title || !url || !source) return null;
  return {
    title,
    url,
    source,
    publishedAt: fieldOf(value, 'publishedAt', isText) ?? null,
    tool: value['tool'] === true,
  };
}

/** The news report, with any headline that does not parse dropped; null when it is not one. */
export function parseNewsReport(body: unknown): NewsReport | null {
  if (!isObject(body) || !Array.isArray(body['ai']) || !Array.isArray(body['engineering']))
    return null;
  return {
    ai: listOf(body['ai'], parseItem),
    engineering: listOf(body['engineering'], parseItem),
    unread: listOf(body['unread'], (value) => (isText(value) ? value : null)),
    readAt: fieldOf(body, 'readAt', isText) ?? '',
  };
}
