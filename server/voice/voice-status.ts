import { cached } from '../util/cached.ts';
import { ElevenLabsError } from './eleven-labs-error.ts';
import type { ElevenLabs, Voice } from './eleven-labs.ts';

/** What `GET /api/voice` returns: whether the page may offer ElevenLabs, and in which voices. */
export interface VoiceStatus {
  readonly elevenlabs: 'on' | 'off';
  readonly voices: readonly Voice[];
  readonly defaultVoice: string | null;
  /** Why the voices could not be listed, in words the page can show as they are. */
  readonly failed?: string;
}

export interface VoiceStatusOptions {
  readonly voice: ElevenLabs;
  /** `ELEVENLABS_VOICE_ID`: the default when the account has it. */
  readonly preferredVoice: string | null;
  readonly warn?: (message: string) => void;
  readonly clock?: () => number;
}

/** An account's voices change rarely; listed again at most this often. */
const VOICES_TTL_MS = 10 * 60_000;

const OFF: VoiceStatus = { elevenlabs: 'off', voices: [], defaultVoice: null };

function defaultOf(voices: readonly Voice[], preferred: string | null): string | null {
  const isListed = voices.some((voice) => voice.id === preferred);
  return isListed ? preferred : (voices[0]?.id ?? null);
}

/**
 * ElevenLabs's state, as the page's picker needs it. With no key it is off and
 * makes no call; a failed list reads as on, with no voices and the reason.
 */
export function voiceStatus(options: VoiceStatusOptions): () => Promise<VoiceStatus> {
  const { voice, preferredVoice, warn = console.warn, clock = Date.now } = options;
  const listed = cached(() => voice.voices(), VOICES_TTL_MS, clock);
  return async () => {
    if (!voice.isOn) return OFF;
    try {
      const voices = await listed();
      return { elevenlabs: 'on', voices, defaultVoice: defaultOf(voices, preferredVoice) };
    } catch (error) {
      if (!(error instanceof ElevenLabsError)) throw error;
      warn(error.message);
      return { elevenlabs: 'on', voices: [], defaultVoice: null, failed: error.words };
    }
  };
}
