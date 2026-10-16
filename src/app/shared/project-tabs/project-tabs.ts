import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavSection } from '../site-header/nav-section';
import { SectionLabel } from '../site-header/section-label';

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

/**
 * A project's screens as a row of links, the current one marked as the page.
 * It only navigates, and shows the sections it is given: what is current, and
 * each one's badge and quiet state, are worked out once by
 * `projectTabSections`. Below 1200px the site header's menu lists the same
 * sections instead, and hides this row.
 */
@Component({
  selector: 'app-project-tabs',
  imports: [RouterLink, SectionLabel],
  templateUrl: './project-tabs.html',
  styleUrl: './project-tabs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTabs {
  readonly tabs = input.required<readonly NavSection[]>();
}
