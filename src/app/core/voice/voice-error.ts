/** Why a step of voice failed. The worker's own: `download` (the network),
 *  `device` (the graphics card or the runtime), `cancelled` (unloaded while it
 *  came), `unloaded` (run with no model) and `silent` (a voice that made no
 *  sound). The page's time limits: `stop`, `model`, `run` and `audio`. */
export type VoiceFailureKind =
  'download' | 'device' | 'cancelled' | 'unloaded' | 'silent' | 'stop' | 'model' | 'run' | 'audio';

const KINDS: ReadonlySet<string> = new Set<VoiceFailureKind>([
  'download',
  'device',
  'cancelled',
  'unloaded',
  'silent',
  'stop',
  'model',
  'run',
  'audio',
]);

export class VoiceError extends Error {
  constructor(
    message: string,
    readonly kind: VoiceFailureKind,
  ) {
    super(message);
    this.name = 'VoiceError';
  }
}

export function isFailureKind(value: unknown): value is VoiceFailureKind {
  return typeof value === 'string' && KINDS.has(value);
}

/** The kind of any error: a VoiceError's own, else `device`. */
export function kindOf(error: unknown): VoiceFailureKind {
  return error instanceof VoiceError ? error.kind : 'device';
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
