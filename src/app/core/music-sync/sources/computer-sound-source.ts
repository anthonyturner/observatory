import { Injectable, InjectionToken, Signal, inject, signal } from '@angular/core';
import { AudioTap } from './audio-tap';
import { UNPROCESSED_AUDIO, captureDisplayAudio } from './display-audio';
import { MEDIA_DEVICES, canShareDisplayAudio } from './media-devices';
import { SoundGuide, SoundOption, SoundSource } from './sound-source.types';

const COMPUTER: SoundOption = { id: 'computer', label: 'Whole computer' };

/** Chromium shares system audio with a whole screen only on these platforms. */
const SYSTEM_AUDIO_PLATFORMS: ReadonlySet<string> = new Set([
  'Windows',
  'Chrome OS',
  'Chromium OS',
]);

/** The platform Chromium reports through `navigator.userAgentData`; null in a
 *  browser that lacks it, as Firefox and Safari do. */
export const BROWSER_PLATFORM = new InjectionToken<string | null>('BROWSER_PLATFORM', {
  providedIn: 'root',
  factory: readBrowserPlatform,
});

function readBrowserPlatform(): string | null {
  const data: unknown = Reflect.get(globalThis.navigator ?? {}, 'userAgentData');
  if (typeof data !== 'object' || data === null) return null;
  const platform: unknown = Reflect.get(data, 'platform');
  return typeof platform === 'string' ? platform : null;
}

/** Chrome's options for sharing a whole screen with the computer's sound, beyond
 *  the standard's typings. */
interface ComputerCaptureOptions extends DisplayMediaStreamOptions {
  readonly systemAudio: 'include';
  readonly monitorTypeSurfaces: 'include';
}

const COMPUTER_CAPTURE: ComputerCaptureOptions = {
  video: { displaySurface: 'monitor' },
  audio: UNPROCESSED_AUDIO,
  systemAudio: 'include',
  monitorTypeSurfaces: 'include',
};

/** Everything the computer plays, from Spotify to another tab, through sharing a
 *  whole screen with its system audio. */
@Injectable({ providedIn: 'root' })
export class ComputerSoundSource implements SoundSource {
  private readonly media = inject(MEDIA_DEVICES);
  private readonly platform = inject(BROWSER_PLATFORM);

  readonly id = COMPUTER.id;
  readonly name = COMPUTER.label;
  readonly guide: SoundGuide = {
    ask: 'Chrome asks to share a screen: pick Entire screen and tick “Also share system audio”. Nothing is recorded or sent.',
    silent: 'The screen was shared without the computer’s sound',
  };
  readonly options: Signal<readonly SoundOption[]> = signal(
    canShareDisplayAudio(this.media) && SYSTEM_AUDIO_PLATFORMS.has(this.platform ?? '')
      ? [COMPUTER]
      : [],
  );

  open(): Promise<AudioTap> {
    return captureDisplayAudio(this.media, COMPUTER_CAPTURE);
  }
}
