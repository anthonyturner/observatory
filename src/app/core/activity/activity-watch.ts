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
import { ACTIVITY_LOOKUPS, Lookup, PullState } from './activity-lookups';
import { Comparison, EMPTY_MEMORY, compareReport } from './activity-memory';
import { ACTIVITY_KINDS, ActivityItem, ActivityKind, Sighting } from './activity.types';

/** At most this many follow-up reads at once, so a busy check does not burst. */
const LOOKUPS_AT_ONCE = 4;
/** Stands in for a new issue's title when it could not be read. */
export const UNREAD_TITLE = 'Open the issue';

const DENIED = 'denied';
type Outcome = ActivityItem | typeof DENIED | null;

const NOTHING_COMPARED: Comparison = { memory: EMPTY_MEMORY, departedPulls: [], newIssues: [] };

/**
 * Merged pull requests and new issues across every tracked project, found by
 * comparing each projects report with the one before. It adds no timer of its
 * own: it follows the projects feed every page already shares. Each event is
 * told once a session, and after a 401 or 403 it tells nothing more.
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
    concatMap((comparison) => this.lookUp(comparison)),
    tap((outcomes) => this.goQuietIfDenied(outcomes)),
    map((outcomes) => (this.isQuiet ? [] : newsIn(outcomes))),
    tap((items) => this.markAnnounced(items)),
    filter((items) => items.length > 0),
    share(),
  );

  private lookUp({ departedPulls, newIssues }: Comparison): Observable<readonly Outcome[]> {
    if (this.isQuiet) return of([]);
    const reads = [
      ...this.unannounced(departedPulls, 'merged').map((pull) => this.mergedPull(pull)),
      ...this.unannounced(newIssues, 'issue').map((issue) => this.newIssue(issue)),
    ];
    return reads.length ? from(reads).pipe(mergeAll(LOOKUPS_AT_ONCE), toArray()) : of([]);
  }

  private unannounced(sightings: readonly Sighting[], kind: ActivityKind): Sighting[] {
    return sightings.filter((sighting) => !this.announced.has(eventKey(kind, sighting)));
  }

  /** A pull request that closed unmerged is not news. */
  private mergedPull(pull: Sighting): Observable<Outcome> {
    return this.lookups.pullState(pull.repo, pull.number).pipe(
      map((lookup: Lookup<PullState>): Outcome => {
        if (lookup.status === 'denied') return DENIED;
        if (lookup.status !== 'found' || lookup.value.state !== 'MERGED') return null;
        return { ...pull, kind: 'merged', title: lookup.value.title };
      }),
    );
  }

  /** The issue is known to be new, so a title that could not be read does not hide it. */
  private newIssue(issue: Sighting): Observable<Outcome> {
    return this.lookups.issueTitle(issue.repo, issue.number).pipe(
      map((lookup: Lookup<string>): Outcome => {
        if (lookup.status === 'denied') return DENIED;
        const title = lookup.status === 'found' ? lookup.value : UNREAD_TITLE;
        return { ...issue, kind: 'issue', title };
      }),
    );
  }

  private goQuietIfDenied(outcomes: readonly Outcome[]): void {
    if (outcomes.includes(DENIED)) this.isQuiet = true;
  }

  private markAnnounced(items: readonly ActivityItem[]): void {
    for (const item of items) this.announced.add(eventKey(item.kind, item));
  }
}

const reportOf = (state: ProjectsState): ProjectsReport | null =>
  state.status === 'ready' ? state.report : null;

/** The key an event is told once under: `repo#kind#number`. */
const eventKey = (kind: ActivityKind, { repo, number }: Sighting): string =>
  `${repo}#${kind}#${number}`;

const isItem = (outcome: Outcome): outcome is ActivityItem =>
  outcome !== null && outcome !== DENIED;

/** Merged pull requests first, then new issues, each by project and number. */
function newsIn(outcomes: readonly Outcome[]): ActivityItem[] {
  return outcomes
    .filter(isItem)
    .sort(
      (a, b) =>
        ACTIVITY_KINDS.indexOf(a.kind) - ACTIVITY_KINDS.indexOf(b.kind) ||
        a.repo.localeCompare(b.repo) ||
        a.number - b.number,
    );
}
