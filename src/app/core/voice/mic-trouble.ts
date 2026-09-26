/* What getUserMedia's refusals mean, in words. Pressing the mic again asks
   again, so a microphone allowed meanwhile just works. */
const BLOCKED =
  'Microphone blocked for this site. Click the icon at the left of the address bar, allow the microphone, then press Tap to talk again. Typing still works.';
const MISSING = 'No microphone found. Connect one and press Tap to talk again, or type instead.';
const IN_USE = 'The microphone is in use by another app. Close it and try again.';

const MIC_TROUBLE: Readonly<Record<string, string>> = {
  NotAllowedError: BLOCKED,
  SecurityError: BLOCKED,
  NotFoundError: MISSING,
  OverconstrainedError: MISSING,
  NotReadableError: IN_USE,
  AbortError: IN_USE,
};

export const CANNOT_RECORD = 'This browser cannot record for voice input. Typing still works.';
export const NEEDS_SECURE_ADDRESS =
  'Voice input needs a secure address (https, or localhost). Typing still works.';

/** Why the microphone would not open, from getUserMedia's error. */
export function micTroubleWords(error: unknown): string {
  const name = nameOf(error) ?? 'unknown error';
  return MIC_TROUBLE[name] ?? `The microphone could not be opened (${name}). Typing still works.`;
}

/** getUserMedia rejects with a DOMException, which is not an Error everywhere. */
function nameOf(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('name' in error)) return null;
  return typeof error.name === 'string' ? error.name : null;
}
