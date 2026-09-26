import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { EFFECTS, NewsEvent } from '../news';
import { NewsState } from '../memory-view';

/** pr-starmap's "Sep 26, 04:16 AM" for a moment. */
export const fmtAt = (iso: string, locale?: string): string =>
  new Date(iso).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Each kind of change once, with how many, in the order they arrived. */
export function tallies(
  events: readonly NewsEvent[],
): { kind: NewsEvent['kind']; count: number }[] {
  const counts = new Map<NewsEvent['kind'], number>();
  for (const e of events) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  return [...counts].map(([kind, count]) => ({ kind, count }));
}

/**
 * pr-starmap's changes panel: what changed since the baseline, a tally per
 * kind and a row per pull request, with Play again and Got it.
 */
@Component({
  selector: 'app-changes-panel',
  templateUrl: './changes-panel.html',
  styleUrl: './changes-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangesPanel {
  readonly news = input.required<NewsState>();
  /** While replaying: the refresh on screen, which the span ends at. */
  readonly replayAt = input<string | null>(null);
  readonly go = output<number>();
  readonly playAgain = output<void>();
  readonly acknowledged = output<void>();

  protected readonly effects = EFFECTS;
  protected readonly title = computed(() => {
    const label = this.news().label;
    return label ? label[0].toUpperCase() + label.slice(1) : '';
  });
  protected readonly span = computed(() => {
    const since = this.news().since;
    if (!since) return '';
    const replayAt = this.replayAt();
    return `${fmtAt(since)} → ${replayAt ? fmtAt(replayAt) : 'now'}`;
  });
  protected readonly tallies = computed(() => tallies(this.news().events));
}
