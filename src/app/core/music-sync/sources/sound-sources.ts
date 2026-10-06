import { InjectionToken, inject } from '@angular/core';
import { ComputerSoundSource } from './computer-sound-source';
import { SoundSource } from './sound-source.types';
import { TabSoundSource } from './tab-sound-source';

/** Every way Sync can hear sound, in the chooser's order; the first this browser
 *  can use is the default. A new source is one more entry here. */
export const SOUND_SOURCES = new InjectionToken<readonly SoundSource[]>('SOUND_SOURCES', {
  providedIn: 'root',
  factory: () => [inject(TabSoundSource), inject(ComputerSoundSource)],
});
