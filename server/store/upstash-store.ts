import { checkedKey, type Store } from './store.ts';

/** Where the hosted site's Redis is, as the Upstash integration names it on Vercel. */
export interface UpstashConfig {
  readonly url: string;
  readonly token: string;
  /** Keeps Observatory's keys apart from anything else in the same database. */
  readonly prefix?: string;
  readonly fetch?: typeof fetch;
}

const DEFAULT_PREFIX = 'obs';
const MAX_ERROR_LENGTH = 200;

/** Upstash's reply to one command: its result, or why it failed. */
interface UpstashReply {
  readonly result?: unknown;
  readonly error?: string;
}

const isReply = (value: unknown): value is UpstashReply =>
  typeof value === 'object' && value !== null;

/**
 * Documents in Upstash Redis through its REST API, one command per request,
 * so a function needs no client library and holds no connection.
 */
export function upstashStore(config: UpstashConfig): Store {
  const { url, token, prefix = DEFAULT_PREFIX, fetch: send = fetch } = config;
  if (!url || !token) {
    throw new Error('the Redis store needs KV_REST_API_URL and KV_REST_API_TOKEN');
  }
  const redisKey = (key: string): string => `${prefix}:${checkedKey(key)}`;

  async function command(args: readonly string[]): Promise<unknown> {
    const response = await send(url.replace(/\/$/, ''), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Redis: HTTP ${response.status} ${text.slice(0, MAX_ERROR_LENGTH)}`);
    }
    const reply: unknown = JSON.parse(text);
    if (!isReply(reply)) throw new Error('Redis: an answer that is not an object');
    if (reply.error) throw new Error(`Redis: ${reply.error}`);
    return reply.result;
  }

  return {
    async get(key) {
      const raw = await command(['GET', redisKey(key)]);
      return typeof raw === 'string' ? (JSON.parse(raw) as unknown) : null;
    },
    async set(key, value) {
      await command(['SET', redisKey(key), JSON.stringify(value)]);
    },
  };
}
