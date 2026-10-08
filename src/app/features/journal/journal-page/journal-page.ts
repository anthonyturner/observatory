import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { map } from 'rxjs';
import { JournalFeed } from '../../../core/journal/journal-feed';
import { PrincipleOfDay } from '../../../core/principles/principle-of-day';
import { ProjectTabs } from '../../../shared/project-tabs/project-tabs';
import { UpLink } from '../../../shared/up-link/up-link';
import { JournalEntryCard } from '../journal-entry/journal-entry';
import { PrincipleTitles, cardsOf, chipsOf } from './journal-view';
import { filterWords, journalStamp, stateMessage } from './journal-words';

const repoOf = (params: ParamMap): string =>
  `${params.get('owner') ?? ''}/${params.get('repo') ?? ''}`;

/**
 * A project's Journal: what each self-review taught, newest first, with the
 * design principle behind each lesson. A principle's chip narrows the list
 * to the lessons that taught it.
 */
@Component({
  selector: 'app-journal-page',
  imports: [UpLink, ProjectTabs, JournalEntryCard],
  providers: [JournalFeed],
  templateUrl: './journal-page.html',
  styleUrls: ['../../releases/releases-page/releases-page.css', './journal-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalPage {
  private readonly feed = inject(JournalFeed);
  private readonly route = inject(ActivatedRoute);
  private readonly principles = inject(PrincipleOfDay);

  private readonly repoChanges = this.route.paramMap.pipe(map(repoOf));
  protected readonly repo = toSignal(this.repoChanges, { initialValue: '' });
  /** The principle the list is narrowed to. */
  protected readonly picked = signal<string | null>(null);

  private readonly report = computed(() => {
    const state = this.feed.state();
    return state.status === 'ready' ? state.report : null;
  });
  /** Empty while the principles are not read: chips then carry the ids, which are still true. */
  private readonly titles = computed((): PrincipleTitles => {
    const state = this.principles.state();
    const deck = state.status === 'ready' ? state.report.principles : [];
    return new Map(deck.map((principle) => [principle.id, principle]));
  });
  private readonly entries = computed(() => this.report()?.entries ?? []);

  protected readonly message = computed(() => stateMessage(this.feed.state()));
  protected readonly stamp = computed(() => journalStamp(this.repo(), this.report()));
  protected readonly chips = computed(() => chipsOf(this.entries(), this.titles()));
  protected readonly cards = computed(() =>
    cardsOf(this.entries(), this.titles(), this.picked()),
  );
  /** The picked principle's title and idea, and how many lessons it taught. */
  protected readonly pickedPrinciple = computed(() => {
    const id = this.picked();
    const chip = this.chips().find((each) => each.id === id);
    if (!chip) return null;
    return {
      line: filterWords(this.cards().length, this.entries().length, chip.label),
      idea: this.titles().get(chip.id)?.idea ?? null,
    };
  });

  constructor() {
    this.repoChanges.pipe(takeUntilDestroyed()).subscribe((repo) => {
      this.picked.set(null);
      this.feed.load(repo);
    });
  }

  /** Narrows the list to `id`, or widens it again when it is already the one. */
  protected toggle(id: string): void {
    this.picked.update((picked) => (picked === id ? null : id));
  }
}
