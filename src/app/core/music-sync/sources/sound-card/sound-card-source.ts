import { Injectable, Signal, computed, inject } from '@angular/core';
import { STREAM_FETCH } from '../../../runs/runs-api';
import { AudioTap } from '../audio-tap';
import { SoundGuide, SoundOption, SoundSource } from '../sound-source.types';
import { SOUND_CARD_AVAILABLE } from './sound-card-availability';
import { openSoundCard } from './sound-card-audio';

const SOUND_CARD: SoundOption = { id: 'sound-card', label: 'Sound card' };

/** Everything the computer plays, heard by Observatory's local server from the
 *  speakers' own output: no share prompt, in any browser on that computer. */
@Injectable({ providedIn: 'root' })
export class SoundCardSource implements SoundSource {
  private readonly isAvailable = inject(SOUND_CARD_AVAILABLE);
  private readonly fetchStream = inject(STREAM_FETCH);

  readonly id = SOUND_CARD.id;
  readonly name = SOUND_CARD.label;
  readonly guide: SoundGuide = {
    ask: 'Observatory’s server on this computer hears whatever it plays: nothing to share or tick, and the sound stays on this computer.',
    silent: 'The local server could not hear the sound card',
  };
  readonly options: Signal<readonly SoundOption[]> = computed(() =>
    this.isAvailable() ? [SOUND_CARD] : [],
  );

  open(): Promise<AudioTap> {
    return openSoundCard(this.fetchStream);
  }
}
