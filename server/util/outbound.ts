/** Waits `ms`; a client takes its own in tests so a retry costs no time. */
export const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Whether a failed call ran out of time, as AbortSignal.timeout ends one. */
export const isTimeout = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
