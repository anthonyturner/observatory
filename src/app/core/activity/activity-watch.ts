import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  Observable,
  concatMap,
  filter,
  from,
  map,
  mergeAll,
  of,
  scan,
  share,
  tap,
  toArray,
} from 'rxjs';
import { ProjectsState } from '../projects/projects-feed';
import { ProjectsReport } from '../projects/projects-report';
import { PROJECTS_STATE } from '../projects/projects-source';
import { foldClosings } from './activity-fold';
import { ACTIVITY_LOOKUPS, IssueState, Lookup, PullState } from './activity-lookups';
import {
  Comparison,
  DepartedPull,
  EMPTY_MEMORY,
  OpenedPull,
  compareReport,
} from './activity-memory';
import { ACTIVITY_KINDS, ActivityItem, ActivityKind, Sighting } from './activity.types';

/** At most this many follow-up reads at once, so a busy check does not burst. */
const LOOKUPS_AT_ONCE = 4;
/** Stands in for a new issue's title when it could not be read. */
export const UNREAD_TITLE = 'Open the issue';
/** Stands in for a new pull request's title when the report did not give one. */
export const UNREAD_PULL_TITLE = 'Open the pull request';

const DENIED = 'denied';
type Outcome = ActivityItem | typeof DENIED | null;

/** One check's comparison and what its follow-up reads came to. */
interface Check {
  readonly merges: readonly DepartedPull[];
  readonly outcomes: readonly Outcome[];
}

const NOTHING_COMPARED: Comparison = {
  memory: EMPTY_MEMORY,
  departedPulls: [],
  openedPulls: [],
  newIssues: [],
  departedIssues: [],
};

/**
 * Pull requests opened and merged, and issues opened and closed, across every
 * tracked project, found by comparing each projects report with the one
 * before. It adds no timer of its own: it follows the projects feed every page
 * already shares. Each event is told once a tab, and after a 401 or 403 it
 * tells nothing more.
 */
@Injectable({ providedIn: 'root' })
export class ActivityWatch {
  private readonly lookups = inject(ACTIVITY_LOOKUPS);
  private readonly announced = new Set<string>();
  private isQuiet = false;

  /** Each check's news, oldest first; a check with none emits nothing. */
  readonly checks: Observable<readonly ActivityItem[]> = toObservable(inject(PROJECTS_STATE)).pipe(
    map(reportOf),
    filter((report): report is ProjectsReport => report !== null),
    scan((last: Comparison, report) => compareReport(last.memory, report), NOTHING_COMPARED),
    concatMap((comparison) => this.check(comparison)),
    tap(({ outcomes }) => this.goQuietIfDenied(outcomes)),
    map(({ outcomes, merges }) => (this.isQuiet ? [] : newsIn(outcomes, merges))),
    tap((items) => this.markAnnounced(items)),
    filter((items) => items.length > 0),
    share(),
  );

  /** A pull request opened needs no read; each departure, and each new issue's
   *  title, takes one. */
  private check(comparison: Comparison): Observable<Check> {
    const merges = comparison.departedPulls;
    if (this.isQuiet) return of({ merges, outcomes: [] });
    const opened = this.unannounced(comparison.openedPulls, 'pull-opened').map(openedPull);
    const reads = [
      ...this.unannounced(merges, 'merged').map((pull) => this.mergedPull(pull)),
      ...this.unannounced(comparison.departedIssues, 'issue-closed').map((issue) =>
        this.closedIssue(issue),
      ),
      ...this.unannounced(comparison.newIssues, 'issue').map((issue) => this.newIssue(issue)),
    ];
    const read = reads.length ? from(reads).pipe(mergeAll(LOOKUPS_AT_ONCE), toArray()) : of([]);
    return read.pipe(map((outcomes) => ({ merges, outcomes: [...opened, ...outcomes] })));
  }

  private unannounced<T extends Sighting>(sightings: readonly T[], kind: ActivityKind): T[] {
    return sightings.filter((sighting) => !this.announced.has(eventKey(kind, sighting)));
  }

  /** A pull request that closed unmerged is not news. */
  private mergedPull(pull: DepartedPull): Observable<Outcome> {
    return this.lookups.pullState(pull.repo, pull.number).pipe(
      map((lookup: Lookup<PullState>): Outcome => {
        if (lookup.status === 'denied') return DENIED;
        if (lookup.status !== 'found' || lookup.value.state !== 'MERGED') return null;
        return { ...sightingOf(pull), kind: 'merged', title: lookup.value.title };
      }),
    );
  }

  /** An issue transferred, deleted or made a discussion also leaves the open
   *  list, so only GitHub's word that it closed counts. */
  private closedIssue(issue: Sighting): Observable<Outcome> {
    return this.lookups.issue(issue.repo, issue.number).pipe(
      map((lookup: Lookup<IssueState>): Outcome => {
        if (lookup.status === 'denied') return DENIED;
        if (lookup.status !== 'found' || lookup.value.closedAt === null) return null;
        return { ...issue, kind: 'issue-closed', title: lookup.value.title };
      }),
    );
  }

  /** The issue is known to be new, so a title that could not be read does not hide it. */
  private newIssue(issue: Sighting): Observable<Outcome> {
    return this.lookups.issue(issue.repo, issue.number).pipe(
      map((lookup: Lookup<IssueState>): Outcome => {
        if (lookup.status === 'denied') return DENIED;
        const title = lookup.status === 'found' ? lookup.value.title : UNREAD_TITLE;
        return { ...issue, kind: 'issue', title };
      }),
    );
  }

  private goQuietIfDenied(outcomes: readonly Outcome[]): void {
    if (outcomes.includes(DENIED)) this.isQuiet = true;
  }

  private markAnnounced(items: readonly ActivityItem[]): void {
    for (const item of items) {
      this.announced.add(eventKey(item.kind, item));
      for (const { number } of item.closing ?? []) {
        this.announced.add(eventKey('issue-closed', { ...item, number }));
      }
    }
  }
}

const reportOf = (state: ProjectsState): ProjectsReport | null =>
  state.status === 'ready' ? state.report : null;

/** The key an event is told once under: `repo#kind#number`. */
const eventKey = (kind: ActivityKind, { repo, number }: Sighting): string =>
  `${repo}#${kind}#${number}`;

const sightingOf = ({ repo, label, number }: Sighting): Sighting => ({ repo, label, number });

const openedPull = ({ title, ...pull }: OpenedPull): ActivityItem => ({
  ...pull,
  kind: 'pull-opened',
  title: title ?? UNREAD_PULL_TITLE,
});

const isItem = (outcome: Outcome): outcome is ActivityItem =>
  outcome !== null && outcome !== DENIED;

/** Merged pull requests, with the issues they closed, first; then by kind,
 *  project and number. */
function newsIn(outcomes: readonly Outcome[], merges: readonly DepartedPull[]): ActivityItem[] {
  return foldClosings(outcomes.filter(isItem), merges).sort(
    (a, b) =>
      ACTIVITY_KINDS.indexOf(a.kind) - ACTIVITY_KINDS.indexOf(b.kind) ||
      a.repo.localeCompare(b.repo) ||
      a.number - b.number,
  );
}
