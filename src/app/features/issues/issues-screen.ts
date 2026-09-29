import { Injectable, computed, inject, signal } from '@angular/core';
import { IssuesFeed } from '../../core/issues/issues-feed';
import { formatRefreshed } from '../../core/logs/log-format';
import { ageWords, fogLevel } from '../../core/projects/data-age';
import { Clock } from '../../core/time/clock';
import { LegendChip, SkyView, fmtN } from '../starmap/starmap-view';
import { COMET_COLOUR } from './issue-inks';
import { IssueStar } from './issue-look';
import { COMET_FILTER, IssueNarrowing, IssueTab, labelOptions, tabInfo } from './issue-list';

const MINUTE_MS = 60_000;
const CLOSED_FRAGMENT = /^issues\/closed/;
const MAP_FRAGMENT = /^issues(\/closed)?\/map$/;
const ISSUES_FRAGMENT = /^issues/;
/** The view the Issues screen opened on last, per viewer. */
const VIEW_KEY = 'observatory.issueView';

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
  /** Issues keep their own Starmap or List, remembered per viewer; a list by default. */
  readonly view = signal<SkyView>('list');
  /** The issue whose card is open on the nursery. */
  readonly picked = signal<IssueStar | null>(null);
  /** The issue read in the issue window. */
  readonly windowIssue = signal<number | null>(null);

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
  /** `#issues`, `#issues/closed`, and `/map` for the nursery. */
  readonly fragment = computed(
    () => `issues${this.tab() === 'closed' ? '/closed' : ''}${this.view() === 'map' ? '/map' : ''}`,
  );

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

  /** What the list knows of the issue in the window, before its own read arrives. */
  readonly windowSeed = computed(() => {
    const number = this.windowIssue();
    const report = this.report();
    if (number === null || !report) return null;
    return [...report.open, ...report.closed].find((issue) => issue.number === number) ?? null;
  });

  /** What the nursery says in place of a disk. */
  readonly skyMessage = computed((): IssuesMessage | null => {
    const report = this.report();
    if (!report) return this.message();
    return report[this.tab()].length ? null : { headline: tabInfo(this.tab()).none };
  });

  /** The tab and view an address opens on: `#issues/closed/map` is the Closed
   *  tab's nursery. An address that names no view opens the one last chosen. */
  openAt(fragment: string | null): void {
    const at = fragment ?? '';
    this.tab.set(CLOSED_FRAGMENT.test(at) ? 'closed' : 'open');
    if (MAP_FRAGMENT.test(at)) this.view.set('map');
    else if (!ISSUES_FRAGMENT.test(at)) this.view.set(readView());
  }

  watch(repo: string): void {
    this.label.set('');
    this.query.set('');
    this.filter.set(null);
    this.picked.set(null);
    this.windowIssue.set(null);
    this.feed.watch(repo);
  }

  /** Starmap or List, remembered for next time. */
  setView(view: SkyView): void {
    this.view.set(view);
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // The list is the default.
    }
  }

  /** `fresh` reads GitHub now rather than the API's cache, for Refresh. */
  refresh(repo: string, fresh = false): void {
    this.feed.refresh(repo, fresh);
  }

  /** Comets are open issues; the filter means nothing on the closed list. */
  setTab(tab: IssueTab): void {
    if (tab === 'closed' && this.filter() === COMET_FILTER) this.filter.set(null);
    this.tab.set(tab);
    this.picked.set(null);
  }

  /** The comet count can be pressed from either tab, and brings the Open list up. */
  toggleComets(): void {
    const next = this.filter() === COMET_FILTER ? null : COMET_FILTER;
    this.filter.set(next);
    if (next) this.tab.set('open');
    this.picked.set(null);
  }

  /** Leaving the screen drops the legend's filter, the card and the window. */
  leave(): void {
    this.filter.set(null);
    this.picked.set(null);
    this.windowIssue.set(null);
  }
}

/** The view last chosen, or the list when storage is blocked. */
function readView(): SkyView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'map' ? 'map' : 'list';
  } catch {
    return 'list';
  }
}
