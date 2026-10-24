/** One screen of a project, reached at `/p/:owner/:repo/<path>`. */
export interface ProjectTab {
  readonly id: string;
  readonly label: string;
  /** Below the project's route; empty for the Review Queue, which is the project's own page. */
  readonly path: string;
  /** Other places below the project's route that belong to this screen: a pull request's
   *  file, opened in its own tab, is still the Review Queue's. */
  readonly alsoAt?: readonly string[];
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
 * Every per-project screen, in the order the site bar shows them. A new screen
 * adds its entry here and its route in `app.routes.ts`.
 */
export const PROJECT_TABS: readonly ProjectTab[] = [
  { id: 'queue', label: 'Queue', path: '', alsoAt: ['pull'] },
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
  PROJECT_TABS.find((tab) => tab.path === path || tab.alsoAt?.includes(path));

/** The anchor of a tab's part of the Guide: the tab's id, except the Review Queue's own name. */
export const guidePartOf = (tab: ProjectTab): string =>
  tab.id === 'queue' ? 'review-queue' : tab.id;

/** Where a tab lives for one repository, `owner/name`. */
export const projectTabLink = (repo: string, tab: ProjectTab): string =>
  tab.path ? `/p/${repo}/${tab.path}` : `/p/${repo}`;
