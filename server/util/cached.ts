/**
 * Wraps `load` so its answer is reused for `ttlMs`, and callers that arrive
 * while it is loading share that one load. A failed load is not kept.
 */
export function cached<T>(
  load: () => Promise<T>,
  ttlMs: number,
  clock: () => number = Date.now,
): () => Promise<T> {
  let value: { readonly at: number; readonly result: T } | null = null;
  let loading: Promise<T> | null = null;

  return () => {
    if (value && clock() - value.at < ttlMs) return Promise.resolve(value.result);
    loading ??= load()
      .then((result) => {
        value = { at: clock(), result };
        return result;
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  };
}
