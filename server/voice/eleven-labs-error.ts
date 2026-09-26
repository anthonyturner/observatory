import type { Complaint } from './eleven-labs-complaint.ts';

/** Each reason a call to ElevenLabs failed, in words a reply can use as they are. */
const REASONS = {
  key: 'the key was refused',
  credit: 'the ElevenLabs account is out of credit or quota',
  input: 'it refused the request',
  voice: 'that voice is not on the account',
  busy: 'rate limited',
  overloaded: 'ElevenLabs is busy',
  timeout: 'it took too long',
  network: 'ElevenLabs could not be reached',
  shape: 'its answer was not readable',
  upstream: 'it failed',
} as const;

export type VoiceFailureReason = keyof typeof REASONS;

const REASON_BY_STATUS: Readonly<Record<number, VoiceFailureReason>> = {
  400: 'input',
  401: 'key',
  402: 'credit',
  403: 'key',
  404: 'voice',
  408: 'timeout',
  422: 'input',
  429: 'busy',
  502: 'overloaded',
  503: 'overloaded',
};

/** ElevenLabs answers 401 for a spent quota as well as a bad key, telling them apart only by this. */
const QUOTA_EXCEEDED = 'quota_exceeded';

/** Why a call failed, from the status ElevenLabs answered with and what its body said. */
export const voiceReasonOf = (status: number, complaint: Complaint): VoiceFailureReason =>
  complaint.status === QUOTA_EXCEEDED ? 'credit' : (REASON_BY_STATUS[status] ?? 'upstream');

/**
 * A failed call, written here from a reason and a scrubbed detail, never from
 * an error object that might carry the request with it: a caller can log or
 * return its message as it is.
 */
export class ElevenLabsError extends Error {
  override readonly name = 'ElevenLabsError';
  readonly reason: VoiceFailureReason;
  readonly status: number | null;
  /** The reason in words a reply can use. */
  readonly words: string;

  constructor(reason: VoiceFailureReason, status: number | null, detail = '') {
    super(
      `ElevenLabs ${status ?? 'call'} failed: ${REASONS[reason]}${detail ? ` (${detail})` : ''}`,
    );
    this.reason = reason;
    this.status = status;
    this.words = REASONS[reason];
  }
}
