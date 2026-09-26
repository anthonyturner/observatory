import { Speaker } from '../../../core/voice/active-voice';

const HEARS = 'Whisper hears';
const KOKORO_CAPTION = `${HEARS} · Kokoro speaks · both local`;
const ELEVENLABS_CAPTION = `${HEARS} · ElevenLabs speaks`;

/** The line under the voice buttons: who hears, and who speaks. */
export function captionFor(speaker: Speaker): string {
  if (speaker.engine === 'kokoro') return KOKORO_CAPTION;
  return speaker.voice ? `${ELEVENLABS_CAPTION} (${speaker.voice.name})` : ELEVENLABS_CAPTION;
}
