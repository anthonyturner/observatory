import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ChangedPull, Changes, changeCount } from '../../../core/queue/changes';

/** One kind of change, as the card lists it. */
export interface ChangeGroup {
  readonly kind: keyof Pick<Changes, 'opened' | 'blocked' | 'unblocked' | 'merged' | 'closed'>;
  readonly label: string;
  /** Still open, so it has a star and a panel to open. */
  readonly isOpen: boolean;
  readonly pulls: readonly ChangedPull[];
}

const GROUPS: readonly Omit<ChangeGroup, 'pulls'>[] = [
  { kind: 'blocked', label: 'Became blocked', isOpen: true },
  { kind: 'opened', label: 'New', isOpen: true },
  { kind: 'unblocked', label: 'Unblocked', isOpen: true },
  { kind: 'merged', label: 'Merged', isOpen: false },
  { kind: 'closed', label: 'Closed', isOpen: false },
];

/** The kinds of change that happened, most pressing first. */
export const changeGroups = (changes: Changes): ChangeGroup[] =>
  GROUPS.map((group) => ({ ...group, pulls: changes[group.kind] })).filter(
    (group) => group.pulls.length > 0,
  );

/** "since you last looked, Sep 25 14:02", or "since the refresh before". */
export function changesHeading(changes: Changes, locale?: string): string {
  const at = new Date(changes.since).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return changes.basis === 'visit'
    ? `since you last looked · ${at}`
    : `since the refresh before · ${at}`;
}

/** What changed since you last looked, with a way to open each and to clear them. */
@Component({
  selector: 'app-changes-card',
  templateUrl: './changes-card.html',
  styleUrl: './changes-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangesCard {
  readonly changes = input.required<Changes>();
  /** Asks to open a pull request's panel. */
  readonly picked = output<number>();
  /** Asks to record this visit, which clears the changes. */
  readonly acknowledged = output<void>();

  protected readonly count = computed(() => changeCount(this.changes()));
  protected readonly groups = computed(() => changeGroups(this.changes()));
  protected readonly heading = computed(() => changesHeading(this.changes()));
}
