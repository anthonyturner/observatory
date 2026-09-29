import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { SoundPreference } from '../../../core/sound/sound-preference';
import { HelpState } from '../../../shared/help/help-state';

const FOLDED_KEY = 'observatory.orrery.folded';

/** A canvas's controls: zoom, Fit, Refresh, Motion, Sound with its volume, and
 *  Help, with a hint of what to do. On a small screen Controls folds them away,
 *  remembered per viewer, as pr-starmap's orrery did. */
@Component({
  selector: 'app-orrery-tools',
  templateUrl: './orrery-tools.html',
  styleUrl: './orrery-tools.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-folded]': 'folded() ? "" : null' },
})
export class OrreryTools {
  readonly hint = input('drag · scroll · click a world');
  readonly zoomOut = output<void>();
  readonly zoomIn = output<void>();
  readonly fit = output<void>();
  readonly refreshing = input(false);
  readonly refresh = output<void>();

  protected readonly motion = inject(MotionPreference);
  protected readonly isMoving = computed(() => !this.motion.isStill());
  protected readonly sound = inject(SoundPreference);
  protected readonly help = inject(HelpState);
  protected readonly volumePercent = computed(() => Math.round(this.sound.volume() * 100));
  protected readonly folded = signal(readFolded());

  protected onVolume(event: Event): void {
    this.sound.setVolume(Number((event.target as HTMLInputElement).value) / 100);
  }

  protected toggleFold(): void {
    const next = !this.folded();
    this.folded.set(next);
    try {
      localStorage.setItem(FOLDED_KEY, next ? '1' : '0');
    } catch {
      // Folded for this visit only.
    }
  }
}

function readFolded(): boolean {
  try {
    return localStorage.getItem(FOLDED_KEY) === '1';
  } catch {
    return false;
  }
}
