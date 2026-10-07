import { BadRequest, json, type RouteTable } from '../http/api-handler.ts';
import { ElevenLabsError } from './eleven-labs-error.ts';
import type { Clip, ElevenLabs } from './eleven-labs.ts';
import { speakRequestFrom } from './speak-request.ts';
import { voiceStatus } from './voice-status.ts';

const VOICE_PATH = '/api/voice';
const SPEAK_PATH = '/api/voice/speak';
const HEAR_PATH = '/api/voice/hear';

/** A 30 s recording is a few hundred KB; base64 in JSON adds a third. */
const HEAR_BODY_LIMIT = 2 * 1024 * 1024;
const MAX_CLIP_BYTES = 1.4 * 1024 * 1024;
const AUDIO_TYPE = /^audio\/[\w.+-]+(;[\w\s=.+-]*)?$/i;

const HTTP_OK = 200;
const HTTP_BAD_GATEWAY = 502;
const HTTP_UNAVAILABLE = 503;
const OFF_ERROR = 'ElevenLabs is off: no key';

export interface VoiceRoutesOptions {
  readonly voice: ElevenLabs;
  /** `ELEVENLABS_VOICE_ID`: the default voice when the account has it. */
  readonly preferredVoice: string | null;
  readonly warn?: (message: string) => void;
}

/** The sentence in `body` spoken, as audio; or why not, as JSON. */
async function spoken(
  voice: ElevenLabs,
  body: unknown,
  warn: (message: string) => void,
): Promise<Response> {
  const request = speakRequestFrom(body);
  if (!voice.isOn) return json(HTTP_UNAVAILABLE, { error: OFF_ERROR });
  try {
    const speech = await voice.speak(request);
    return new Response(speech.audio, {
      status: HTTP_OK,
      headers: { 'content-type': speech.contentType, 'cache-control': 'no-store' },
    });
  } catch (error) {
    if (!(error instanceof ElevenLabsError)) throw error;
    warn(error.message);
    return json(HTTP_BAD_GATEWAY, { error: error.words });
  }
}

/** The words in the recording in `body` ({ audio: base64, type, keyterms? }), or why not. */
async function heard(
  voice: ElevenLabs,
  body: unknown,
  warn: (message: string) => void,
): Promise<Response> {
  const clip = clipFrom(body);
  if (!voice.isOn) return json(HTTP_UNAVAILABLE, { error: OFF_ERROR });
  try {
    return json(HTTP_OK, { text: await voice.hear(clip) });
  } catch (error) {
    if (!(error instanceof ElevenLabsError)) throw error;
    warn(error.message);
    return json(HTTP_BAD_GATEWAY, { error: error.words });
  }
}

/** The words to expect: none when the page sent none. */
function keytermsFrom(body: object): readonly string[] {
  const keyterms: unknown = Reflect.get(body, 'keyterms');
  if (keyterms === undefined) return [];
  if (!Array.isArray(keyterms) || !keyterms.every((term) => typeof term === 'string'))
    throw new BadRequest('bad request: keyterms');
  return keyterms;
}

function clipFrom(body: unknown): Clip {
  if (typeof body !== 'object' || body === null) throw new BadRequest('bad request: no audio');
  const audio: unknown = Reflect.get(body, 'audio');
  const type: unknown = Reflect.get(body, 'type');
  if (typeof audio !== 'string' || !audio) throw new BadRequest('bad request: no audio');
  if (typeof type !== 'string' || !AUDIO_TYPE.test(type))
    throw new BadRequest('bad request: not audio');
  const bytes = Buffer.from(audio, 'base64');
  if (!bytes.length || bytes.length > MAX_CLIP_BYTES)
    throw new BadRequest('bad request: clip size');
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return { audio: copy, contentType: type, keyterms: keytermsFrom(body) };
}

/**
 * `table` with the ElevenLabs voice, a second reply voice beside the page's own:
 *
 *   GET  /api/voice          { elevenlabs: 'on'|'off', voices: [{ id, name }], defaultVoice, failed? }
 *   POST /api/voice/speak    { text, voice } → the audio; 400, 503 with no key, 502 when ElevenLabs fails
 *   POST /api/voice/hear     { audio: base64, type, keyterms? } → { text }; 400, 503 with no key, 502 when ElevenLabs fails
 */
export function withVoiceRoutes(table: RouteTable, options: VoiceRoutesOptions): RouteTable {
  const { voice, warn = console.warn } = options;
  const status = voiceStatus({ voice, preferredVoice: options.preferredVoice, warn });
  return {
    ...table,
    get: { ...table.get, [VOICE_PATH]: () => status() },
    post: {
      ...table.post,
      [SPEAK_PATH]: (body) => spoken(voice, body, warn),
      [HEAR_PATH]: (body) => heard(voice, body, warn),
    },
    bodyLimits: { ...table.bodyLimits, [HEAR_PATH]: HEAR_BODY_LIMIT },
  };
}
