import { BadRequest } from '../http/api-handler.ts';
import type { SpeakRequest } from './eleven-labs.ts';

/** The page sends one sentence at a time; this bounds what one request can cost. */
export const MAX_SPEECH_LENGTH = 1000;
/** An ElevenLabs voice id, and nothing that could reach another path of its API. */
const VOICE_ID = /^[A-Za-z0-9]{1,64}$/;

type Json = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null;

function textOf(body: Json): string {
  const text = typeof body['text'] === 'string' ? body['text'].trim() : '';
  if (!text) throw new BadRequest('bad request: nothing to say');
  if (text.length > MAX_SPEECH_LENGTH) {
    throw new BadRequest(`bad request: longer than ${MAX_SPEECH_LENGTH} characters`);
  }
  return text;
}

function voiceOf(body: Json): string {
  const voice = body['voice'];
  if (typeof voice !== 'string' || !VOICE_ID.test(voice)) {
    throw new BadRequest('bad request: not a voice id');
  }
  return voice;
}

/** What `POST /api/voice/speak` was sent, or a BadRequest. */
export function speakRequestFrom(body: unknown): SpeakRequest {
  if (!isObject(body) || Array.isArray(body)) throw new BadRequest('body must be an object');
  return { text: textOf(body), voice: voiceOf(body) };
}
