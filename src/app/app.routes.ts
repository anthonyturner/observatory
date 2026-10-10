import { Routes, provideRouter, withRouterConfig } from '@angular/router';
import { GUIDE_PATH } from './core/guide/guide-link';
import { libraryMatcher } from './core/library/library-route';

const agentDetailPage = () =>
  import('./features/agents/agent-detail-page/agent-detail-page').then((m) => m.AgentDetailPage);

export const routes: Routes = [
  {
    path: '',
    title: 'Home · Observatory',
    loadComponent: () => import('./features/home/home-page/home-page').then((m) => m.HomePage),
  },
  {
    path: 'orrery',
    title: 'Orrery · Observatory',
    loadComponent: () =>
      import('./features/orrery/orrery-page/orrery-page').then((m) => m.OrreryPage),
  },
  {
    path: 'inbox',
    title: 'Inbox · Observatory',
    loadComponent: () => import('./features/inbox/inbox-page/inbox-page').then((m) => m.InboxPage),
  },
  {
    path: GUIDE_PATH,
    title: 'Guide · Observatory',
    loadComponent: () => import('./features/guide/guide-page/guide-page').then((m) => m.GuidePage),
  },
  {
    path: 'agents',
    children: [
      {
        path: '',
        title: 'Agents · Observatory',
        loadComponent: () =>
          import('./features/agents/agents-page/agents-page').then((m) => m.AgentsPage),
      },
      {
        path: ':session',
        title: 'Agent · Observatory',
        loadComponent: agentDetailPage,
      },
      {
        path: ':session/:agentId',
        title: 'Agent · Observatory',
        loadComponent: agentDetailPage,
      },
    ],
  },
  {
    path: 'p/:owner/:repo',
    loadComponent: () =>
      import('./features/project-shell/project-shell').then((m) => m.ProjectShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Review Queue · Observatory',
        loadComponent: () =>
          import('./features/starmap/starmap-page/starmap-page').then((m) => m.StarmapPage),
      },
      {
        path: 'releases',
        title: 'Releases · Observatory',
        loadComponent: () =>
          import('./features/releases/releases-page/releases-page').then((m) => m.ReleasesPage),
      },
      {
        path: 'actions',
        title: 'Actions · Observatory',
        loadComponent: () =>
          import('./features/actions/actions-page/actions-page').then((m) => m.ActionsPage),
      },
      {
        path: 'journal',
        title: 'Journal · Observatory',
        loadComponent: () =>
          import('./features/journal/journal-page/journal-page').then((m) => m.JournalPage),
      },
      {
        matcher: libraryMatcher,
        title: 'Library · Observatory',
        loadComponent: () =>
          import('./features/library/library-page/library-page').then((m) => m.LibraryPage),
      },
      {
        path: 'depth',
        title: 'Depth · Observatory',
        loadComponent: () =>
          import('./features/depth/depth-page/depth-page').then((m) => m.DepthPage),
      },
      {
        path: 'architecture',
        title: 'Architecture · Observatory',
        loadComponent: () =>
          import('./features/architecture/architecture-page/architecture-page').then(
            (m) => m.ArchitecturePage,
          ),
      },
      {
        path: 'security',
        title: 'Security · Observatory',
        loadComponent: () =>
          import('./features/security/security-page/security-page').then((m) => m.SecurityPage),
      },
      {
        path: 'insights',
        title: 'Insights · Observatory',
        loadComponent: () =>
          import('./features/insights/insights-page/insights-page').then((m) => m.InsightsPage),
      },
      {
        path: 'deployments',
        title: 'Deployments · Observatory',
        loadComponent: () =>
          import('./features/deployments/deployments-page/deployments-page').then(
            (m) => m.DeploymentsPage,
          ),
      },
      {
        path: 'milestones',
        title: 'Milestones · Observatory',
        loadComponent: () =>
          import('./features/milestones/milestones-page/milestones-page').then(
            (m) => m.MilestonesPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

/** The app's router: its routes, with each screen below a project reading the project's `owner` and `repo`. */
export const provideAppRouter = () =>
  provideRouter(routes, withRouterConfig({ paramsInheritanceStrategy: 'always' }));
