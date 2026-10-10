import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { plural } from '../text/plural';
import { QuietTab } from './quiet-tab';
import { QUIET_TABS } from './quiet-tabs';
import { TAB_BADGES, TabBadge } from './tab-badge';

/** One screen of a project, reached at `/p/:owner/:repo/<path>`. */
export interface ProjectTab {
  readonly id: string;
  readonly label: string;
  /** Below the project's route; empty for the Review Queue, which is the project's own page. */
  readonly path: string;
}

/** The Actions screen, which Home's project cards also link to. */
export const ACTIONS_TAB: ProjectTab = { id: 'actions', label: 'Actions', path: 'actions' };

/** The Library screen: the project's wiki, or its README and docs. */
export const LIBRARY_TAB: ProjectTab = { id: 'library', label: 'Library', path: 'library' };

/** The Security screen: open Dependabot, code-scanning and secret-scanning alerts. */
export const SECURITY_TAB: ProjectTab = { id: 'security', label: 'Security', path: 'security' };

/** The Milestones screen, with the project's Discussions beside them. Last, as many have neither. */
export const MILESTONES_TAB: ProjectTab = {
  id: 'milestones',
  label: 'Milestones',
  path: 'milestones',
};

/**
 * Every per-project screen, in the order the strip shows them. A new screen
 * adds its entry here and its route in `app.routes.ts`, and passes its `id`
 * as the strip's `current` on its page.
 */
export const PROJECT_TABS: readonly ProjectTab[] = [
  { id: 'queue', label: 'Queue', path: '' },
  { id: 'releases', label: 'Releases', path: 'releases' },
  ACTIONS_TAB,
  { id: 'journal', label: 'Journal', path: 'journal' },
  LIBRARY_TAB,
  { id: 'depth', label: 'Depth', path: 'depth' },
  { id: 'architecture', label: 'Architecture', path: 'architecture' },
  SECURITY_TAB,
  { id: 'insights', label: 'Insights', path: 'insights' },
  { id: 'deployments', label: 'Deployments', path: 'deployments' },
  MILESTONES_TAB,
];

/** Where a tab lives for one repository, `owner/name`. */
export const projectTabLink = (repo: string, tab: ProjectTab): string =>
  tab.path ? `/p/${repo}/${tab.path}` : `/p/${repo}`;

interface BadgeView {
  readonly shown: string;
  /** Read after the tab's name: "3 open alerts". */
  readonly spoken: string;
}

interface TabLink {
  readonly id: string;
  readonly label: string;
  readonly link: string;
  readonly isCurrent: boolean;
  readonly badge: BadgeView | null;
  /** The project has nothing on this screen, so the tab recedes. */
  readonly isQuiet: boolean;
}

type BadgeCounts = ReadonlyMap<string, BadgeView>;

const NO_BADGES: BadgeCounts = new Map();
const NONE_QUIET: ReadonlySet<string> = new Set();

/** Each badge's count for `repo`, as views by tab id; a count of none shows no badge. */
function badgeViews(badges: readonly TabBadge[], repo: string): Observable<BadgeCounts> {
  if (!badges.length || !repo) return of(NO_BADGES);
  const each = badges.map((badge) =>
    badge.count(repo).pipe(
      startWith(null),
      map((count) => ({ badge, count })),
    ),
  );
  return combineLatest(each).pipe(
    map(
      (counts) =>
        new Map(
          counts.flatMap(({ badge, count }) =>
            count
              ? [[badge.tabId, { shown: String(count), spoken: plural(count, badge.noun) }]]
              : [],
          ),
        ),
    ),
  );
}

/** The ids of the tabs `repo` has nothing on. */
function quietIds(tabs: readonly QuietTab[], repo: string): Observable<ReadonlySet<string>> {
  if (!tabs.length || !repo) return of(NONE_QUIET);
  const each = tabs.map((tab) =>
    tab.isEmpty(repo).pipe(
      startWith(false),
      map((isEmpty) => (isEmpty ? tab.tabId : null)),
    ),
  );
  return combineLatest(each).pipe(
    map((ids) => new Set(ids.filter((id): id is string => id !== null))),
  );
}

/** The row of a project's screens, on every one of them: links, the current one marked as the page. */
@Component({
  selector: 'app-project-tabs',
  imports: [RouterLink],
  templateUrl: './project-tabs.html',
  styleUrl: './project-tabs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTabs {
  private readonly badges = inject(TAB_BADGES);
  private readonly quietTabs = inject(QUIET_TABS);

  /** `owner/name`. */
  readonly repo = input.required<string>();
  /** The id of the screen this strip sits on. */
  readonly current = input.required<string>();

  private readonly counts = toSignal(
    toObservable(this.repo).pipe(switchMap((repo) => badgeViews(this.badges, repo))),
    { initialValue: NO_BADGES },
  );
  private readonly quiet = toSignal(
    toObservable(this.repo).pipe(switchMap((repo) => quietIds(this.quietTabs, repo))),
    { initialValue: NONE_QUIET },
  );

  protected readonly links = computed((): readonly TabLink[] =>
    PROJECT_TABS.map((tab) => ({
      id: tab.id,
      label: tab.label,
      link: projectTabLink(this.repo(), tab),
      isCurrent: tab.id === this.current(),
      badge: this.counts().get(tab.id) ?? null,
      isQuiet: this.quiet().has(tab.id),
    })),
  );
}
