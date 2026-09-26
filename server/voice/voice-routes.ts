import { json, type RouteTable } from '../http/api-handler.ts';
import { ElevenLabsError } from './eleven-labs-error.ts';
import type { ElevenLabs } from './eleven-labs.ts';
import { speakRequestFrom } from './speak-request.ts';
import { voiceStatus } from './voice-status.ts';

export const VOICE_PATH = '/api/voice';
export const SPEAK_PATH = '/api/voice/speak';

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

/**
 * `table` with the ElevenLabs voice, a second reply voice beside the page's own:
 *
 *   GET  /api/voice          { elevenlabs: 'on'|'off', voices: [{ id, name }], defaultVoice, failed? }
 *   POST /api/voice/speak    { text, voice } → the audio; 400, 503 with no key, 502 when ElevenLabs fails
 */
export function withVoiceRoutes(table: RouteTable, options: VoiceRoutesOptions): RouteTable {
  const { voice, warn = console.warn } = options;
  const status = voiceStatus({ voice, preferredVoice: options.preferredVoice, warn });
  return {
    ...table,
    get: { ...table.get, [VOICE_PATH]: () => status() },
    post: { ...table.post, [SPEAK_PATH]: (body) => spoken(voice, body, warn) },
  };
}
