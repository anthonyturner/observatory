import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HistoryFeed } from '../../../core/queue/history-feed';
import { Clock } from '../../../core/time/clock';
import { UsageWatch } from '../../../core/usage/usage-watch';
import { ELEMENT_WIDTH } from '../../../shared/element-width/element-width';
import { mergesSince, projectBars, projectFor, projectNote, toolBars } from './bar-items';
import { UsageBarsSection } from './usage-bars/usage-bars';
import { UsageLimitsSection } from './usage-limits/usage-limits';
import { TipAt, UsageTip, tipAt } from '../../../shared/charts/usage-tip/usage-tip';
import { UsageTokensSection } from './usage-tokens/usage-tokens';

/** Charts are drawn at the list's width, within these bounds. */
const MIN_WIDTH = 280;
const MAX_WIDTH = 920;
/** Until the list has been measured. */
export const DEFAULT_WIDTH = 880;
const MINUTE_MS = 60_000;

export const chartWidth = (measured: number): number =>
  Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, measured || DEFAULT_WIDTH));

/**
 * pr-starmap's Usage screen: Claude Code's plan limits and a month of tokens,
 * by day, model, project and tool. The usage is the account's, not the
 * project's, so every star map shows the same report with its own project
 * picked out. It is read only while this screen is open.
 */
@Component({
  selector: 'app-starmap-usage',
  imports: [UsageLimitsSection, UsageTokensSection, UsageBarsSection, UsageTip],
  templateUrl: './starmap-usage.html',
  styleUrl: './starmap-usage.css',
  host: { '(pointermove)': 'pointAt($event)', '(pointerleave)': 'tip.set(null)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarmapUsage {
  /** "owner/name": the project this star map is for. */
  readonly repo = input.required<string>();

  private readonly watch = inject(UsageWatch);
  private readonly frames = inject(HistoryFeed).frames;
  private readonly clock = inject(Clock).now;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly width = toSignal(inject(ELEMENT_WIDTH)(this.host).pipe(map(chartWidth)), {
    initialValue: DEFAULT_WIDTH,
  });
  /** The time to the minute: nothing here changes faster. */
  protected readonly now = computed(
    () => Math.floor(this.clock().getTime() / MINUTE_MS) * MINUTE_MS,
  );
  protected readonly state = this.watch.state;
  protected readonly document = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.document : null;
  });
  protected readonly projects = computed(() => {
    const document = this.document();
    const tokens = document?.tokens;
    if (!document?.projects.length || !tokens) return null;
    const repo = this.repo();
    const isMine = Boolean(projectFor(document.projects, repo));
    return {
      small: `tokens, last ${tokens.days} days${isMine ? ' · this one lit' : ''}`,
      note: projectNote({
        projects: document.projects,
        repo,
        days: tokens.days,
        merges: mergesSince(this.frames(), tokens.from),
      }),
      items: projectBars(document.projects, repo),
    };
  });
  protected readonly tools = computed(() => {
    const document = this.document();
    if (!document?.tools.length || !document.tokens) return null;
    return {
      small: `most called, last ${document.tokens.days} days`,
      items: toolBars(document.tools),
    };
  });
  protected readonly tip = signal<TipAt | null>(null);

  constructor() {
    this.watch.start();
    inject(DestroyRef).onDestroy(() => this.watch.stop());
  }

  /** Any chart mark with a `data-tip` shows its text beside the pointer. */
  protected pointAt(event: PointerEvent): void {
    this.tip.set(tipAt(event));
  }
}
