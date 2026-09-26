import { InjectionToken } from '@angular/core';

/** What Whisper reads: 16 kHz on one channel. */
export const WHISPER_RATE = 16000;
/** Shorter than a quarter second is a click, not a word. */
const SHORTEST_S = 0.25;
/** Quieter than this all the way through is a room, not a voice. */
const QUIET_PEAK = 0.02;

/** A recording as Whisper reads it, or null when it holds no sound. */
export const CLIP_DECODER = new InjectionToken<(clip: Blob) => Promise<Float32Array | null>>(
  'ClipDecoder',
  { providedIn: 'root', factory: () => to16k },
);

/** Decoding in a 16 kHz context resamples the clip; its channels are then
 *  averaged into one. */
export async function to16k(clip: Blob): Promise<Float32Array | null> {
  const data = await clip.arrayBuffer();
  if (!data.byteLength) return null;
  const decoded = await new OfflineAudioContext(1, 1, WHISPER_RATE).decodeAudioData(data);
  const mono = new Float32Array(decoded.length);
  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    const samples = decoded.getChannelData(channel);
    for (let i = 0; i < mono.length; i++) mono[i] += samples[i] / decoded.numberOfChannels;
  }
  return mono;
}

export function isQuiet(audio: Float32Array): boolean {
  if (audio.length < WHISPER_RATE * SHORTEST_S) return true;
  let peak = 0;
  for (const sample of audio) peak = Math.max(peak, Math.abs(sample));
  return peak < QUIET_PEAK;
}

/** Whisper names what it heard, in brackets, when there were no words. */
export function isWordless(text: string): boolean {
  return !text || /^[[(].*[\])]$/.test(text);
}
