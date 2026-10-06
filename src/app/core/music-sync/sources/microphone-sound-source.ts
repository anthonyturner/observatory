import { Injectable, Signal, inject, signal } from '@angular/core';
import { AudioTap, CaptureUnsupportedError } from './audio-tap';
import { UNPROCESSED_AUDIO } from './display-audio';
import { captureInputAudio } from './input-audio';
import { MEDIA_DEVICES, canShareDisplay } from './media-devices';
import { SoundGuide, SoundOption, SoundSource } from './sound-source.types';

const MICROPHONE: SoundOption = { id: 'microphone', label: 'Microphone' };

/** A phone's own microphone, which hears the room, the phone's speaker included: no
 *  phone's browser lets a page hear its sound any other way. Offered only where the
 *  browser cannot share a screen, as on a phone; a desktop picks its microphone from
 *  Input device instead. */
@Injectable({ providedIn: 'root' })
export class MicrophoneSoundSource implements SoundSource {
  private readonly media = inject(MEDIA_DEVICES);
  private readonly isUsable =
    typeof this.media?.getUserMedia === 'function' && !canShareDisplay(this.media);

  readonly id = MICROPHONE.id;
  readonly name = MICROPHONE.label;
  readonly guide: SoundGuide = {
    ask: 'The phone asks to use its microphone: allow it. The mic hears the room, so play the music out loud; with headphones on it hears nothing of the music. Nothing is recorded or sent.',
    silent: 'No microphone was found, or another app is using it',
  };
  /** Opening a phone's microphone is the listener's own call, made with Sync: Play
   *  alone never asks for it. */
  readonly opensWithPlay = false;
  readonly options: Signal<readonly SoundOption[]> = signal(this.isUsable ? [MICROPHONE] : []);

  /** Opens the phone's default input, with the browser's call processing off. */
  open(): Promise<AudioTap> {
    const media = this.media;
    if (!this.isUsable || !media) return Promise.reject(new CaptureUnsupportedError());
    return captureInputAudio(media, UNPROCESSED_AUDIO);
  }
}
