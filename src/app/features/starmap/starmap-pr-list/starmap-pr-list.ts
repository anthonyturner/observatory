import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { StackNote, Stacks } from '../../../core/queue/stacks';
import { BUCKETS, SkyItem, isQuick } from '../engine/sky-model';

/** One bucket's section of the list. */
export interface PrSection {
  readonly id: string;
  readonly label: string;
  readonly sub: string;
  readonly colour: string;
  readonly items: readonly SkyItem[];
}

/** What a row says of its stack: plain, or wanting an update because its base merged. */
export interface StackLine {
  readonly text: string;
  readonly isLanded: boolean;
}

/** The queue as pr-starmap lists it: a section per bucket, narrowed by the legend. */
export function prSections(items: readonly SkyItem[], filter: string | null): PrSection[] {
  return BUCKETS.filter((b) => !filter || filter === 'quick' || filter === b.id)
    .map((b) => ({
      id: b.id,
      label: b.label,
      sub: b.sub,
      colour: b.colour,
      items: items.filter((i) => i.bucket === b.id && (filter !== 'quick' || isQuick(i))),
    }))
    .filter((section) => section.items.length > 0);
}

/** "closes #12 · idle 4d", or "closes nothing · idle 4d". */
export const prDetail = (item: SkyItem): string =>
  `${item.issues.length ? `closes #${item.issues[0]}` : 'closes nothing'} · idle ${item.idleDays}d`;

const numbers = (prs: readonly number[]): string => prs.map((pr) => `#${pr}`).join(', ');

/** "base #12 merged · update it", "stacked on #12 · #14 stacked on it". */
export function stackLine({ landed, parent, children }: StackNote): StackLine {
  const parts = [
    ...(landed ? [`base #${landed.number} merged · update it`] : []),
    ...(parent !== null ? [`stacked on #${parent}`] : []),
    ...(children.length ? [`${numbers(children)} stacked on it`] : []),
  ];
  return { text: parts.join(' · '), isLanded: landed !== null };
}

/** The review queue as a list: each row flies to its star and opens it. */
@Component({
  selector: 'app-starmap-pr-list',
  templateUrl: './starmap-pr-list.html',
  styleUrl: './starmap-pr-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarmapPrList {
  readonly items = input.required<readonly SkyItem[]>();
  readonly filter = input<string | null>(null);
  /** Stacked pull requests, said on their rows. */
  readonly stacks = input<Stacks>(new Map());
  readonly go = output<number>();

  protected readonly sections = computed(() => prSections(this.items(), this.filter()));
  protected readonly stackLines = computed(
    () => new Map([...this.stacks()].map(([pr, note]) => [pr, stackLine(note)])),
  );
  protected readonly detail = prDetail;

  protected onKey(event: KeyboardEvent, pr: number): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.go.emit(pr);
  }
}
