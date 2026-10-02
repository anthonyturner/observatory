/** How long an answer is kept: a fixed time, or a time that depends on the answer. */
export type Lifetime<T> = number | ((result: T) => number);

const lifetimeOf = <T>(lifetime: Lifetime<T>, result: T): number =>
  typeof lifetime === 'number' ? lifetime : lifetime(result);

/**
 * Wraps `load` so its answer is reused for `ttlMs`, and callers that arrive
 * while it is loading share that one load. A failed load is not kept.
 */
export function cached<T>(
  load: () => Promise<T>,
  ttlMs: Lifetime<T>,
  clock: () => number = Date.now,
): () => Promise<T> {
  let value: { readonly at: number; readonly result: T; readonly keepMs: number } | null = null;
  let loading: Promise<T> | null = null;

  return () => {
    if (value && clock() - value.at < value.keepMs) return Promise.resolve(value.result);
    loading ??= load()
      .then((result) => {
        value = { at: clock(), result, keepMs: lifetimeOf(ttlMs, result) };
        return result;
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  };
}
