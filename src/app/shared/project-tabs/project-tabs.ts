import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Observable, combineLatest, filter, map, of, startWith, switchMap } from 'rxjs';
import { ELEMENT_SIZE } from '../element-size/element-size';
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

/** The tab at `path` below a project's route, if there is one. */
export const projectTabAt = (path: string): ProjectTab | undefined =>
  PROJECT_TABS.find((tab) => tab.path === path);

/** The anchor of a tab's part of the Guide: the tab's id, except the Review Queue's own name. */
export const guidePartOf = (tab: ProjectTab): string =>
  tab.id === 'queue' ? 'review-queue' : tab.id;

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

/** What the collapsed menu's button shows: the current screen, and that a badge is waiting. */
interface ToggleView {
  readonly name: string;
  readonly count: string | null;
  /** Another screen has a badge: a dot with no number, which would read as this screen's. */
  readonly hasDot: boolean;
  /** Every badge, read out after the name: "Security: 3 open alerts". */
  readonly spoken: string | null;
}

type BadgeCounts = ReadonlyMap<string, BadgeView>;

const NO_BADGES: BadgeCounts = new Map();
const NONE_QUIET: ReadonlySet<string> = new Set();

const UNKNOWN_SCREEN = 'Screens';

let menus = 0;

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
 * A project's screens: links, the current one marked as the page. It only
 * navigates; the project's other controls sit beside it in the project shell.
 *
 * The links are rendered once. The stylesheet shows them as a row on a wide
 * screen and, on a narrow one, behind a button as a drop-down: the disclosure
 * navigation pattern, whose list is plain links and not a `role="menu"`.
 */
@Component({
  selector: 'app-project-tabs',
  imports: [RouterLink],
  templateUrl: './project-tabs.html',
  styleUrl: './project-tabs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // The project shell raises its bar above the page while this class is set.
    '[class.open]': 'isOpen()',
    '(document:pointerdown)': 'closeOutside($event)',
    '(keydown.escape)': 'closeOnEscape($event)',
    '(focusout)': 'closeWhenFocusLeaves($event)',
  },
})
export class ProjectTabs {
  private readonly badges = inject(TAB_BADGES);
  private readonly quietTabs = inject(QUIET_TABS);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');

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

  protected readonly toggleView = computed((): ToggleView => {
    const links = this.links();
    const current = links.find((link) => link.isCurrent);
    const badged = links.flatMap((link) =>
      link.badge ? [`${link.label}: ${link.badge.spoken}`] : [],
    );
    return {
      name: current?.label ?? UNKNOWN_SCREEN,
      count: current?.badge?.shown ?? null,
      hasDot: badged.length > 0 && !current?.badge,
      spoken: badged.length ? badged.join(', ') : null,
    };
  });

  protected readonly menuId = `project-tabs-menu-${++menus}`;
  protected readonly isOpen = signal(false);

  constructor() {
    const sizeOf = inject(ELEMENT_SIZE);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() =>
      sizeOf(this.button().nativeElement)
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe(({ width, height }) => {
          if (!width && !height) this.isOpen.set(false);
        }),
    );
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.isOpen.set(false));
  }

  /** Opening focuses the button, so Escape reaches the list even where a click does not focus. */
  protected toggle(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      return;
    }
    this.isOpen.set(true);
    this.button().nativeElement.focus();
  }

  /** Choosing a screen closes the list and leaves focus on the button, not on a hidden link. */
  protected chooseLink(): void {
    if (this.isOpen()) this.closeToButton();
  }

  protected closeOnEscape(event: Event): void {
    if (!this.isOpen()) return;
    // The page closes its top card on Escape; here it closes only the list.
    event.stopPropagation();
    this.closeToButton();
  }

  protected closeOutside(event: Event): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  protected closeWhenFocusLeaves(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && !this.host.nativeElement.contains(next)) this.isOpen.set(false);
  }

  private closeToButton(): void {
    this.isOpen.set(false);
    this.button().nativeElement.focus();
  }
}
