/** Each reason a call to OpenRouter failed, in words a reply can use as they are. */
const REASONS = {
  key: 'the key was refused',
  credit: 'the OpenRouter account is out of credit',
  input: 'it refused the request',
  busy: 'rate limited',
  overloaded: 'OpenRouter is busy',
  timeout: 'it took too long',
  network: 'OpenRouter could not be reached',
  shape: 'its answer was not readable',
  upstream: 'it failed',
} as const;

export type FailureReason = keyof typeof REASONS;

const REASON_BY_STATUS: Readonly<Record<number, FailureReason>> = {
  400: 'input',
  401: 'key',
  402: 'credit',
  403: 'key',
  408: 'timeout',
  422: 'input',
  429: 'busy',
  502: 'overloaded',
  503: 'overloaded',
  529: 'overloaded',
};

/** Why a call failed, from the status OpenRouter answered with. */
export const reasonOf = (status: number): FailureReason => REASON_BY_STATUS[status] ?? 'upstream';

/**
 * A failed call, written here from a reason and a scrubbed detail, never from
 * an error object that might carry the request with it: a caller can log or
 * return its message as it is.
 */
export class OpenRouterError extends Error {
  override readonly name = 'OpenRouterError';
  readonly reason: FailureReason;
  readonly status: number | null;
  /** The reason in words a reply can use. */
  readonly words: string;

  constructor(reason: FailureReason, status: number | null, detail = '') {
    super(
      `OpenRouter ${status ?? 'call'} failed: ${REASONS[reason]}${detail ? ` (${detail})` : ''}`,
    );
    this.reason = reason;
    this.status = status;
    this.words = REASONS[reason];
  }
}
