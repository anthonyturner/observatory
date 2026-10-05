import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DoneItem, DoneKind, isPull } from '../../../core/queue/done-work';

/** One day of finished work. */
export interface DoneDay {
  readonly day: string;
  readonly label: string;
  readonly items: readonly DoneItem[];
}

const KIND_LABEL: Readonly<Record<DoneKind, string>> = {
  merged: 'merged',
  closed: 'closed',
  issue: 'issue',
  dropped: 'dropped',
};

/** "Today", "Yesterday", or "Mon, Sep 29". */
export function dayLabel(day: string, now: Date, locale?: string): string {
  const at = new Date(`${day}T12:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const days = Math.round((today.getTime() - at.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return at.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Finished work grouped by day, newest day first, in the order it was given. */
export function doneDays(items: readonly DoneItem[], now: Date, locale?: string): DoneDay[] {
  const days = new Map<string, DoneItem[]>();
  for (const item of items) days.set(item.day, [...(days.get(item.day) ?? []), item]);
  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, list]) => ({ day, label: dayLabel(day, now, locale), items: list }));
}

/** "12 merged · 3 closed · 8 issues", or that nothing has finished yet. */
export function doneSummary(items: readonly DoneItem[]): string {
  const count = (kind: DoneKind) => items.filter((item) => item.kind === kind).length;
  const parts = [
    [count('merged'), 'merged'],
    [count('closed'), 'closed'],
    [count('issue'), count('issue') === 1 ? 'issue done' : 'issues done'],
    [count('dropped'), 'dropped'],
  ].filter(([n]) => n);
  return parts.length
    ? `${parts.map(([n, label]) => `${n} ${label}`).join(' · ')} in 60 days`
    : 'Nothing finished in the last 60 days yet. Merged pull requests and closed issues land here.';
}

/** The Done list: finished work by day, beside the Spiral of Done it lights. */
@Component({
  selector: 'app-done-panel',
  templateUrl: './done-panel.html',
  styleUrl: './done-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonePanel {
  readonly items = input<readonly DoneItem[]>([]);
  readonly lit = input<string | null>(null);
  /** The row under the pointer or focus, by key, or null when it leaves. */
  readonly light = output<string | null>();
  readonly open = output<DoneItem>();

  protected readonly days = computed(() => doneDays(this.items(), new Date()));
  protected readonly summary = computed(() => doneSummary(this.items()));
  protected readonly kindLabel = KIND_LABEL;
  protected readonly isPull = isPull;
}
