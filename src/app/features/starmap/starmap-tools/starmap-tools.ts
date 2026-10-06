import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { StarmapSound } from '../sound/starmap-sound';
import { HelpState } from '../../../shared/help/help-state';
import { NextStar } from '../next-star';
import { BlackHoleSetting, MAX_STALE_DAYS, MIN_STALE_DAYS } from '../black-hole/black-hole-setting';
import { Chart, SkyView, isListOnly } from '../starmap-view';

const FOLDED_KEY = 'observatory.folded';

/** The screens the first group switches between. */
const CHARTS: readonly { readonly id: Chart; readonly label: string }[] = [
  { id: 'prs', label: 'Pull requests' },
  { id: 'logs', label: 'Logs' },
  { id: 'issues', label: 'Issues' },
  { id: 'usage', label: 'Usage' },
];

/**
 * The bottom tools, by purpose: which sky, Starmap or List, zoom, Next star,
 * what the sky draws, the side panels, Refresh, Motion and Sound, then help.
 * What only the map uses hides on a list. On a small screen Controls folds
 * them away, remembered per viewer.
 */
@Component({
  selector: 'app-starmap-tools',
  templateUrl: './starmap-tools.html',
  styleUrl: './starmap-tools.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-folded]': 'folded() ? "" : null' },
})
export class StarmapTools {
  readonly chart = input.required<Chart>();
  readonly view = input.required<SkyView>();
  readonly showCollisions = input(true);
  readonly planOn = input(false);
  readonly agentsOn = input(false);
  readonly doneOn = input(false);
  readonly refreshing = input(false);
  readonly refreshFailed = input(false);
  /** The pull request Next star would open, or null when nothing is workable. */
  readonly next = input<NextStar | null>(null);

  readonly chartChange = output<Chart>();
  readonly viewChange = output<SkyView>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly fit = output<void>();
  readonly collisions = output<void>();
  readonly plan = output<void>();
  readonly agents = output<void>();
  readonly done = output<void>();
  readonly nextStar = output<void>();
  readonly refresh = output<void>();

  protected readonly charts = CHARTS;
  protected readonly motion = inject(MotionPreference);
  protected readonly sound = inject(StarmapSound);
  protected readonly volumePercent = computed(() => Math.round(this.sound.volume() * 100));

  protected readonly blackHole = inject(BlackHoleSetting);
  protected readonly minHoleDays = MIN_STALE_DAYS;
  protected readonly maxHoleDays = MAX_STALE_DAYS;

  /** A cleared or out-of-range field shows the threshold actually kept. */
  protected onHoleDays(event: Event): void {
    const field = event.target as HTMLInputElement;
    this.blackHole.set(field.valueAsNumber);
    field.value = String(this.blackHole.staleAfterDays());
  }

  protected onVolume(event: Event): void {
    this.sound.setVolume(Number((event.target as HTMLInputElement).value) / 100);
  }
  protected readonly help = inject(HelpState);
  /** Folded away on a small screen; the page hides its charts with the tools. */
  readonly folded = model(readFolded());
  /** Zoom, Starmap / List and the hint mean nothing over a list-only screen. */
  protected readonly skyHidden = computed(() => isListOnly(this.chart()));
  /** Zoom, the sky's layers, the side panels and the hint need the map, not a list. */
  protected readonly onMap = computed(() => !this.skyHidden() && this.view() === 'map');
  /** The queue's overlays mean nothing over the issues. */
  protected readonly queueHidden = computed(() => this.skyHidden() || this.chart() === 'issues');
  protected readonly nextTitle = computed(() => {
    const next = this.next();
    return next
      ? `Next star (n): #${next.pr} ${next.title} — ${next.why}`
      : 'Nothing in the queue to work next';
  });
  protected readonly motionTitle = computed(() =>
    this.motion.choice() === 'auto'
      ? 'Following your system setting — click to override'
      : 'Overriding your system setting — click to switch',
  );

  protected toggleFold(): void {
    const next = !this.folded();
    this.folded.set(next);
    try {
      localStorage.setItem(FOLDED_KEY, next ? '1' : '0');
    } catch {
      // This visit only.
    }
  }
}

/** Open when storage is blocked. */
function readFolded(): boolean {
  try {
    return localStorage.getItem(FOLDED_KEY) === '1';
  } catch {
    return false;
  }
}
