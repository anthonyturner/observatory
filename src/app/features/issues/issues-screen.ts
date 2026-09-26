import { Injectable, computed, inject, signal } from '@angular/core';
import { IssuesFeed } from '../../core/issues/issues-feed';
import { formatRefreshed } from '../../core/logs/log-format';
import { ageWords, fogLevel } from '../../core/projects/data-age';
import { Clock } from '../../core/time/clock';
import { LegendChip, fmtN } from '../starmap/starmap-view';
import { COMET_COLOUR } from './issue-inks';
import { COMET_FILTER, IssueNarrowing, IssueTab, labelOptions } from './issue-list';

const MINUTE_MS = 60_000;
const CLOSED_FRAGMENT = /^issues\/closed/;

/** A message in place of the Issues screen's content. */
export interface IssuesMessage {
  readonly headline: string;
  readonly detail?: string;
}

/**
 * The Issues screen's state on the star map page, as pr-starmap keeps it: the
 * tab, the label and search that narrow it, the legend's comet filter, and
 * what the header says about the issues read.
 */
@Injectable()
export class IssuesScreen {
  private readonly feed = inject(IssuesFeed);
  private readonly now = inject(Clock).now;

  readonly tab = signal<IssueTab>('open');
  readonly label = signal('');
  readonly query = signal('');
  /** The legend's filter: comets only, or none. */
  readonly filter = signal<string | null>(null);

  readonly state = this.feed.state;
  readonly report = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.report : null;
  });
  /** The clock to the minute, so the rows' ages are not rebuilt every second. */
  readonly minute = computed(() => Math.floor(this.now().getTime() / MINUTE_MS) * MINUTE_MS);
  readonly narrowing = computed<IssueNarrowing>(() => ({
    label: this.label(),
    query: this.query(),
    cometsOnly: this.filter() === COMET_FILTER,
  }));
  /** The tabs' counts, once there is something read. */
  readonly counts = computed(() => {
    const total = this.report()?.total;
    return total ? { open: fmtN(total.open), closed: fmtN(total.closed) } : null;
  });
  readonly labels = computed(() => labelOptions(this.report()?.[this.tab()] ?? [], this.label()));
  readonly fragment = computed(() => (this.tab() === 'closed' ? 'issues/closed' : 'issues'));

  readonly chips = computed((): LegendChip[] => {
    const report = this.report();
    const comets = report?.total.comets ?? 0;
    return [
      {
        id: COMET_FILTER,
        colour: COMET_COLOUR,
        count: comets,
        text: `nobody on ${comets === 1 ? 'it' : 'them'}`,
        live: comets > 0,
      },
    ];
  });
  readonly stamp = computed(() => {
    const report = this.report();
    if (!report) return 'no issues read yet';
    const { total } = report;
    return (
      `${report.repo ? `${report.repo} · ` : ''}${fmtN(total.open)} open · ` +
      `${fmtN(total.closed)} closed in ${report.days} days · refreshed ${formatRefreshed(report.generatedAt)}`
    );
  });
  readonly fog = computed(() => {
    const report = this.report();
    return report ? fogLevel(report.generatedAt, new Date(this.minute())) : 0;
  });
  readonly stale = computed(() => {
    const report = this.report();
    return report && this.fog() > 0
      ? `fogged · ${ageWords(report.generatedAt, new Date(this.minute()))} old`
      : null;
  });
  /** What the list says when there are no issues to list. */
  readonly message = computed((): IssuesMessage | null => {
    if (this.state().status === 'unreachable') {
      return { headline: 'The issues are out of reach.', detail: 'Is the API running?' };
    }
    return this.report()
      ? null
      : {
          headline: 'No issues read yet.',
          detail: 'The next refresh reads them, or press Refresh.',
        };
  });

  /** The tab an address opens on: `#issues/closed` is the Closed tab. */
  openAt(fragment: string | null): void {
    this.tab.set(CLOSED_FRAGMENT.test(fragment ?? '') ? 'closed' : 'open');
  }

  watch(repo: string): void {
    this.label.set('');
    this.query.set('');
    this.filter.set(null);
    this.feed.watch(repo);
  }

  refresh(repo: string): void {
    this.feed.refresh(repo);
  }

  /** Comets are open issues; the filter means nothing on the closed list. */
  setTab(tab: IssueTab): void {
    if (tab === 'closed' && this.filter() === COMET_FILTER) this.filter.set(null);
    this.tab.set(tab);
  }

  /** The comet count can be pressed from either tab, and brings the Open list up. */
  toggleComets(): void {
    const next = this.filter() === COMET_FILTER ? null : COMET_FILTER;
    this.filter.set(next);
    if (next) this.tab.set('open');
  }

  /** Leaving the screen drops the legend's filter, as pr-starmap's does. */
  clearFilter(): void {
    this.filter.set(null);
  }
}
