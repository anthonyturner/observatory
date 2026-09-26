import { VoiceError, isFailureKind } from './voice-error';
import { SpokenClip, VoiceModelId, VoiceReply } from './voice-protocol';

const MODELS: ReadonlySet<unknown> = new Set<VoiceModelId>(['listen', 'speak']);

/** Whether a message from the worker is one it is meant to send. */
export function isVoiceReply(data: unknown): data is VoiceReply {
  if (typeof data !== 'object' || data === null || !('op' in data)) return false;
  const reply = data as Record<string, unknown>;
  switch (reply['op']) {
    case 'lost':
      return MODELS.has(reply['model']);
    case 'progress':
      return isNumber(reply['id']) && isNumber(reply['loaded']) && isNumber(reply['total']);
    case 'done':
      return isNumber(reply['id']) && typeof reply['result'] === 'object';
    case 'failed':
      return (
        isNumber(reply['id']) &&
        isFailureKind(reply['kind']) &&
        typeof reply['message'] === 'string'
      );
    default:
      return false;
  }
}

export function readCached(result: unknown): boolean {
  return field(result, 'cached') === true;
}

export function readTranscript(result: unknown): string {
  const text = field(result, 'text');
  if (typeof text !== 'string') throw malformed();
  return text;
}

export function readClip(result: unknown): SpokenClip {
  const audio = field(result, 'audio');
  const rate = field(result, 'rate');
  if (
    !(audio instanceof Float32Array) ||
    !(audio.buffer instanceof ArrayBuffer) ||
    !isNumber(rate)
  ) {
    throw malformed();
  }
  return { audio: new Float32Array(audio.buffer, audio.byteOffset, audio.length), rate };
}

function field(result: unknown, name: string): unknown {
  return typeof result === 'object' && result !== null && name in result
    ? (result as Record<string, unknown>)[name]
    : undefined;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function malformed(): VoiceError {
  return new VoiceError('The voice worker answered in an unexpected shape', 'device');
}
