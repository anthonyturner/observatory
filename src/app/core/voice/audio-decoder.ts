import { Injectable, InjectionToken, inject } from '@angular/core';
import { SpokenClip } from './voice-protocol';

/** Encoded audio, such as MP3, as the samples a reply plays. */
export interface AudioDecoder {
  decode(encoded: ArrayBuffer): Promise<SpokenClip>;
}

/** The parts of a decoded sound that mixing it to one channel reads. */
export type DecodedSound = Pick<AudioBuffer, 'numberOfChannels' | 'length' | 'getChannelData'>;

/** ElevenLabs sends 44.1 kHz MP3; decoding at its own rate skips a resample. */
const DECODE_RATE = 44_100;
/** An offline context here renders nothing, so it takes the smallest length allowed. */
const RENDER_FRAMES = 1;
const MONO = 1;

/** Every channel averaged into one. */
export function monoOf(sound: DecodedSound): Float32Array<ArrayBuffer> {
  const mono = new Float32Array(sound.length);
  for (let channel = 0; channel < sound.numberOfChannels; channel++) {
    const samples = sound.getChannelData(channel);
    for (let i = 0; i < mono.length; i++) mono[i] += samples[i] / sound.numberOfChannels;
  }
  return mono;
}

/** Decodes with Web Audio in a context of its own, which needs no leave to
 *  play sound and leaves the speaker output alone. */
@Injectable({ providedIn: 'root' })
export class WebAudioDecoder implements AudioDecoder {
  async decode(encoded: ArrayBuffer): Promise<SpokenClip> {
    const context = new OfflineAudioContext(MONO, RENDER_FRAMES, DECODE_RATE);
    const sound = await context.decodeAudioData(encoded);
    return { audio: monoOf(sound), rate: sound.sampleRate };
  }
}

export const AUDIO_DECODER = new InjectionToken<AudioDecoder>('AudioDecoder', {
  providedIn: 'root',
  factory: () => inject(WebAudioDecoder),
});
