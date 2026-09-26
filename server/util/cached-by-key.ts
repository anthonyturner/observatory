import { cached } from './cached.ts';

/** `cached` for a load that takes a key: each key keeps its own answer. */
export function cachedByKey<T>(
  load: (key: string) => Promise<T>,
  ttlMs: number,
  clock: () => number = Date.now,
): (key: string) => Promise<T> {
  const byKey = new Map<string, () => Promise<T>>();
  return (key) => {
    let read = byKey.get(key);
    if (!read) {
      read = cached(() => load(key), ttlMs, clock);
      byKey.set(key, read);
    }
    return read();
  };
}
