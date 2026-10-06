import { Injectable, Signal, inject, signal } from '@angular/core';
import { AudioTap } from './audio-tap';
import { UNPROCESSED_AUDIO, captureDisplayAudio } from './display-audio';
import { MEDIA_DEVICES, canShareDisplayAudio } from './media-devices';
import { SoundGuide, SoundOption, SoundSource } from './sound-source.types';

const TAB: SoundOption = { id: 'tab', label: 'This tab' };

/** Chrome's options for capturing this tab, beyond the standard's typings. */
interface TabCaptureOptions extends DisplayMediaStreamOptions {
  readonly preferCurrentTab: true;
  readonly selfBrowserSurface: 'include';
}

const TAB_CAPTURE: TabCaptureOptions = {
  video: true,
  audio: UNPROCESSED_AUDIO,
  preferCurrentTab: true,
  selfBrowserSurface: 'include',
};

/** This tab's own sound, offering it first in Chrome's share prompt: the playlist,
 *  heard wherever a share can carry sound. */
@Injectable({ providedIn: 'root' })
export class TabSoundSource implements SoundSource {
  private readonly media = inject(MEDIA_DEVICES);

  readonly id = TAB.id;
  readonly name = TAB.label;
  readonly guide: SoundGuide = {
    ask: 'Chrome asks to share this tab: pick it and tick “Share tab audio”. Nothing is recorded or sent.',
    silent: 'The tab was shared without its sound',
  };
  readonly options: Signal<readonly SoundOption[]> = signal(
    canShareDisplayAudio(this.media) ? [TAB] : [],
  );

  open(): Promise<AudioTap> {
    return captureDisplayAudio(this.media, TAB_CAPTURE);
  }
}
