import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { LiveAgentsLink } from '../../agents/live-agents-link/live-agents-link';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { StarmapSound } from '../sound/starmap-sound';
import { HelpState } from '../../../shared/help/help-state';
import { NextStar } from '../next-star';
import { SprintPhase } from '../sprint/review-sprint';
import { BlackHoleSetting, MAX_STALE_DAYS, MIN_STALE_DAYS } from '../black-hole/black-hole-setting';
import { MAX_WIP_LIMIT, MIN_WIP_LIMIT, WipLimitSetting } from '../wip-limit/wip-limit-setting';
import { StoredWholeNumber } from '../../../core/settings/stored-whole-number';
import { Chart, SkyView, isListOnly } from '../starmap-view';
import { Disclosure } from '../../../shared/disclosure/disclosure';

/** The screens the first group switches between. */
const CHARTS: readonly { readonly id: Chart; readonly label: string }[] = [
  { id: 'prs', label: 'Pull requests' },
  { id: 'logs', label: 'Logs' },
  { id: 'issues', label: 'Issues' },
  { id: 'usage', label: 'Usage' },
  { id: 'retro', label: 'Retro' },
];

/**
 * The Review Queue's tools, by purpose: which sky, Starmap or List, zoom, Next
 * star and Sprint, what the sky draws and the timeline, the side panels, the
 * repo's agent sessions, then the settings, Refresh and help. What only the map
 * uses hides on a list.
 *
 * One element is both the dock and the drawer. From 1200px wide and 501px tall
 * it is a dock along the foot, with the settings behind a Settings button that
 * opens upward. Below that, a Tools button raises the same controls as a sheet
 * over the sky, the settings inline; the CSS makes the switch, so nothing is
 * drawn twice. A control that opens another surface closes the sheet; one that
 * only changes a setting leaves it open.
 */
@Component({
  selector: 'app-starmap-tools',
  imports: [LiveAgentsLink, Disclosure],
  templateUrl: './starmap-tools.html',
  styleUrl: './starmap-tools.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-open]': 'isRaised() ? "" : null' },
})
export class StarmapTools {
  /** The queue's repository (owner/name), whose agents the Agent sessions link counts. */
  readonly repo = input<string | null>(null);
  readonly chart = input.required<Chart>();
  readonly view = input.required<SkyView>();
  readonly showCollisions = input(true);
  readonly planOn = input(false);
  readonly agentsOn = input(false);
  readonly doneOn = input(false);
  /** Whether the queue's timeline has days to show here, and whether it is open. */
  readonly timelineReady = input(false);
  readonly timelineOn = input(false);
  readonly refreshing = input(false);
  readonly refreshFailed = input(false);
  /** The pull request Next star would open, or null when nothing is workable. */
  readonly next = input<NextStar | null>(null);
  /** Where the review sprint stands, or null when none is open. */
  readonly sprintPhase = input<SprintPhase | null>(null);

  readonly chartChange = output<Chart>();
  readonly viewChange = output<SkyView>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly fit = output<void>();
  readonly collisions = output<void>();
  readonly plan = output<void>();
  readonly agents = output<void>();
  readonly done = output<void>();
  readonly timeline = output<void>();
  readonly nextStar = output<void>();
  readonly sprint = output<void>();
  readonly refresh = output<void>();

  protected readonly charts = CHARTS;
  protected readonly motion = inject(MotionPreference);
  protected readonly sound = inject(StarmapSound);
  protected readonly volumePercent = computed(() => Math.round(this.sound.volume() * 100));

  protected readonly blackHole = inject(BlackHoleSetting);
  protected readonly minHoleDays = MIN_STALE_DAYS;
  protected readonly maxHoleDays = MAX_STALE_DAYS;
  protected readonly wipLimit = inject(WipLimitSetting);
  protected readonly minWipLimit = MIN_WIP_LIMIT;
  protected readonly maxWipLimit = MAX_WIP_LIMIT;

  /** A cleared or out-of-range field shows the number actually kept. */
  protected onNumberField(event: Event, setting: StoredWholeNumber): void {
    const field = event.target as HTMLInputElement;
    setting.set(field.valueAsNumber);
    field.value = String(setting.value());
  }

  protected onVolume(event: Event): void {
    this.sound.setVolume(Number((event.target as HTMLInputElement).value) / 100);
  }
  protected readonly help = inject(HelpState);
  private readonly drawer = viewChild<Disclosure>('drawer');
  private readonly settings = viewChild<Disclosure>('settings');
  /** Whether the sheet or the Settings list is open, so the page can lift the tools over its panels. */
  protected readonly isRaised = computed(
    () => !!this.drawer()?.isOpen() || !!this.settings()?.isOpen(),
  );
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
  /** A sprint under way, or its summary, is run from its own panel. */
  protected readonly sprintBusy = computed(() => {
    const phase = this.sprintPhase();
    return phase === 'running' || phase === 'summary';
  });
  protected readonly motionTitle = computed(() =>
    this.motion.choice() === 'auto'
      ? 'Following your system setting — click to override'
      : 'Overriding your system setting — click to switch',
  );

  protected pickChart(chart: Chart): void {
    if (chart !== this.chart()) this.chartChange.emit(chart);
  }
}
