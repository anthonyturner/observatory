import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { countBarsOf } from '../../../core/projects/count-bars';
import { severityOf } from '../../../core/projects/severity';
import { OrreryWorld } from '../../../core/orrery/world-layout';

/** A world's card: its worst problem, what is waiting, and the ways onward. */
@Component({
  selector: 'app-world-card',
  templateUrl: './world-card.html',
  styleUrl: './world-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--sev]': 'world().color' },
})
export class WorldCard {
  readonly world = input.required<OrreryWorld>();
  readonly closed = output<void>();
  /** Asks to open this project's review queue. */
  readonly openQueue = output<string>();
  /** Asks to open Home at this project's card. */
  readonly showOnHome = output<string>();

  protected readonly project = computed(() => this.world().project);
  protected readonly kind = computed(() => severityOf(this.project()).kind);
  protected readonly bars = computed(() => countBarsOf(this.project()));
  protected readonly pullsUrl = computed(() => `https://github.com/${this.project().repo}/pulls`);
}
