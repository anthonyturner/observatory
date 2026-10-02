import { type Lifetime, cached } from './cached.ts';

/** Answers by key, each kept for a while, and any one of them dropped on demand. */
export interface KeyedCache<T, K extends string = string> {
  read(key: K): Promise<T>;
  /** The next read of `key` loads it again. */
  forget(key: K): void;
}

export function keyedCache<T, K extends string = string>(
  load: (key: K) => Promise<T>,
  ttlMs: Lifetime<T>,
  clock: () => number = Date.now,
): KeyedCache<T, K> {
  const byKey = new Map<K, () => Promise<T>>();
  return {
    read(key) {
      let read = byKey.get(key);
      if (!read) {
        read = cached(() => load(key), ttlMs, clock);
        byKey.set(key, read);
      }
      return read();
    },
    forget(key) {
      byKey.delete(key);
    },
  };
}

/** `cached` for a load that takes a key: each key keeps its own answer. */
export function cachedByKey<T>(
  load: (key: string) => Promise<T>,
  ttlMs: Lifetime<T>,
  clock: () => number = Date.now,
): (key: string) => Promise<T> {
  const cache = keyedCache(load, ttlMs, clock);
  return (key) => cache.read(key);
}
