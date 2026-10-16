import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, ParamMap, Router, RouterOutlet } from '@angular/router';
import { filter, map, of, startWith, switchMap } from 'rxjs';
import { GUIDE_LINK } from '../../core/guide/guide-link';
import { PublishSize } from '../../shared/publish-size/publish-size';
import { projectTabSections } from '../../shared/project-tabs/project-tab-sections';
import {
  guidePartOf,
  ProjectTab,
  ProjectTabs,
  projectTabAt,
} from '../../shared/project-tabs/project-tabs';
import { RunPreviewButton } from '../../shared/run-preview-button/run-preview-button';
import { NavSection } from '../../shared/site-header/nav-section';
import { SiteHeader } from '../../shared/site-header/site-header';
import { UpLink } from '../../shared/up-link/up-link';

const repoOf = (params: ParamMap): string =>
  `${params.get('owner') ?? ''}/${params.get('repo') ?? ''}`;

const ALL_PROJECTS: NavSection = { id: 'all-projects', label: 'All projects', link: '/orrery' };

/**
 * The parent of a project's screens at `/p/:owner/:repo`: the site header with
 * the way up, the screens' tabs and the Run button, drawn once above the routed
 * screen. Moving between screens swaps only the screen below, so a dev server
 * that is still starting is not forgotten on the way.
 */
@Component({
  selector: 'app-project-shell',
  imports: [RouterOutlet, SiteHeader, UpLink, ProjectTabs, RunPreviewButton, PublishSize],
  templateUrl: './project-shell.html',
  styleUrl: './project-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectShell {
  private readonly route = inject(ActivatedRoute);

  /** `owner/name`. */
  protected readonly repo = toSignal(this.route.paramMap.pipe(map(repoOf)), { initialValue: '' });
  private readonly tab = toSignal(
    inject(Router).events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      switchMap(() => this.route.firstChild?.url ?? of([])),
      map((url): ProjectTab | undefined => projectTabAt(url[0]?.path ?? '')),
    ),
  );
  protected readonly repoName = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('repo') ?? '')),
    {
      initialValue: '',
    },
  );
  protected readonly allProjects = ALL_PROJECTS;
  private readonly currentTab = computed(() => this.tab()?.id ?? '');
  protected readonly guide = computed((): string | null => {
    const tab = this.tab();
    return tab ? guidePartOf(tab) : null;
  });
  protected readonly tabs = projectTabSections(this.repo, this.currentTab);
  /** The header's menu: the way up, this screen's part of the Guide, then every screen. */
  protected readonly sections = computed((): readonly NavSection[] => {
    const part = this.guide();
    const guide: NavSection[] = part
      ? [{ id: 'guide', label: 'Guide', link: GUIDE_LINK, fragment: part }]
      : [];
    return [ALL_PROJECTS, ...guide, ...this.tabs()];
  });
}
