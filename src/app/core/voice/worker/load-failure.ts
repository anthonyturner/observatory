import { VoiceError, VoiceFailureKind, messageOf } from '../voice-error';

/** The runtime fetches its WebAssembly itself, so its wording is read too. */
const NETWORK = /failed to fetch|networkerror|network error|load failed/i;

export interface LoadOutcome {
  readonly wasAborted: boolean;
  readonly hasFetchFailed: boolean;
}

/** Why a load failed: unloaded while it came, the network, or the device. */
export function loadFailureKind(error: unknown, outcome: LoadOutcome): VoiceFailureKind {
  if (outcome.wasAborted) return 'cancelled';
  if (error instanceof VoiceError) return error.kind;
  return outcome.hasFetchFailed || NETWORK.test(messageOf(error)) ? 'download' : 'device';
}
