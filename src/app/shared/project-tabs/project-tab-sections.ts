import { Signal, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { NavBadge, NavSection } from '../site-header/nav-section';
import { plural } from '../text/plural';
import { PROJECT_TABS, projectTabLink } from './project-tabs';
import { QuietTab } from './quiet-tab';
import { QUIET_TABS } from './quiet-tabs';
import { TAB_BADGES, TabBadge } from './tab-badge';

type BadgeCounts = ReadonlyMap<string, NavBadge>;

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

/**
 * Every screen of `repo` as a section, the one with the id `current` marked as
 * the page, each with its badge and whether it recedes. This is the only place
 * those are worked out, so the bar's links and the list behind its More button,
 * which both show them, ask the badges and the project only once. Call it where a signal can
 * be made from an Observable: a field initialiser or a constructor.
 */
export function projectTabSections(
  repo: Signal<string>,
  current: Signal<string>,
): Signal<readonly NavSection[]> {
  const tabBadges = inject(TAB_BADGES);
  const quietTabs = inject(QUIET_TABS);
  const counts = toSignal(
    toObservable(repo).pipe(switchMap((name) => badgeViews(tabBadges, name))),
    { initialValue: NO_BADGES },
  );
  const quiet = toSignal(toObservable(repo).pipe(switchMap((name) => quietIds(quietTabs, name))), {
    initialValue: NONE_QUIET,
  });
  return computed(() =>
    PROJECT_TABS.map((tab) => ({
      id: tab.id,
      label: tab.label,
      link: projectTabLink(repo(), tab),
      isCurrent: tab.id === current(),
      badge: counts().get(tab.id),
      isQuiet: quiet().has(tab.id),
    })),
  );
}
