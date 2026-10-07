import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** One screen of a project, reached at `/p/:owner/:repo/<path>`. */
export interface ProjectTab {
  readonly id: string;
  readonly label: string;
  /** Below the project's route; empty for the Review Queue, which is the project's own page. */
  readonly path: string;
}

/**
 * Every per-project screen, in the order the strip shows them. A new screen
 * adds its entry here and its route in `app.routes.ts`, and passes its `id`
 * as the strip's `current` on its page.
 */
export const PROJECT_TABS: readonly ProjectTab[] = [
  { id: 'queue', label: 'Queue', path: '' },
  { id: 'releases', label: 'Releases', path: 'releases' },
];

/** Where a tab lives for one repository, `owner/name`. */
export const projectTabLink = (repo: string, tab: ProjectTab): string =>
  tab.path ? `/p/${repo}/${tab.path}` : `/p/${repo}`;

interface TabLink {
  readonly id: string;
  readonly label: string;
  readonly link: string;
  readonly isCurrent: boolean;
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
  /** `owner/name`. */
  readonly repo = input.required<string>();
  /** The id of the screen this strip sits on. */
  readonly current = input.required<string>();

  protected readonly links = computed((): readonly TabLink[] =>
    PROJECT_TABS.map((tab) => ({
      id: tab.id,
      label: tab.label,
      link: projectTabLink(this.repo(), tab),
      isCurrent: tab.id === this.current(),
    })),
  );
}
