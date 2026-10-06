import { Signal } from '@angular/core';
import { AudioTap } from './audio-tap';

/** One entry in the Sync source chooser. */
export interface SoundOption {
  /** Kept in local storage as the choice, shaped as `option-id.ts` says. Never
   *  change one once shipped. */
  readonly id: string;
  readonly label: string;
}

/** What Sync tells the listener about a source. */
export interface SoundGuide {
  /** What the browser is about to ask, and what to pick or tick. */
  readonly ask: string;
  /** What went wrong when the share came without its sound. */
  readonly silent: string;
}

/** One way the page can hear real sound, offered in the Sync source chooser. */
export interface SoundSource {
  /** Unique among sources, and the prefix of each of its option ids. */
  readonly id: string;
  /** Names the source in the chooser, heading its entries where it has several. */
  readonly name: string;
  readonly guide: SoundGuide;
  /** Whether the first Play of a visit asks for it too, not only Sync. */
  readonly opensWithPlay: boolean;
  /** Its entries in the chooser now; none where this browser cannot use it. */
  readonly options: Signal<readonly SoundOption[]>;
  /** Asks to hear the entry `optionId`, one of `options`; must run inside a click
   *  or key press, as the browser requires. */
  open(optionId: string): Promise<AudioTap>;
}
