import { Routes } from '@angular/router';
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
    path: 'architecture',
    title: 'Architecture · Observatory',
    loadComponent: () =>
      import('./features/architecture/architecture-page/architecture-page').then(
        (m) => m.ArchitecturePage,
      ),
  },
  {
    path: 'inbox',
    title: 'Inbox · Observatory',
    loadComponent: () => import('./features/inbox/inbox-page/inbox-page').then((m) => m.InboxPage),
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
    path: 'p/:owner/:repo/releases',
    title: 'Releases · Observatory',
    loadComponent: () =>
      import('./features/releases/releases-page/releases-page').then((m) => m.ReleasesPage),
  },
  {
    path: 'p/:owner/:repo/actions',
    title: 'Actions · Observatory',
    loadComponent: () =>
      import('./features/actions/actions-page/actions-page').then((m) => m.ActionsPage),
  },
  {
    path: 'p/:owner/:repo/journal',
    title: 'Journal · Observatory',
    loadComponent: () =>
      import('./features/journal/journal-page/journal-page').then((m) => m.JournalPage),
  },
  {
    path: 'p/:owner/:repo/depth',
    title: 'Depth · Observatory',
    loadComponent: () => import('./features/depth/depth-page/depth-page').then((m) => m.DepthPage),
  },
  {
    path: 'p/:owner/:repo/security',
    title: 'Security · Observatory',
    loadComponent: () =>
      import('./features/security/security-page/security-page').then((m) => m.SecurityPage),
  },
  {
    path: 'p/:owner/:repo/insights',
    title: 'Insights · Observatory',
    loadComponent: () =>
      import('./features/insights/insights-page/insights-page').then((m) => m.InsightsPage),
  },
  {
    matcher: libraryMatcher,
    title: 'Library · Observatory',
    loadComponent: () =>
      import('./features/library/library-page/library-page').then((m) => m.LibraryPage),
  },
  {
    path: 'p/:owner/:repo',
    title: 'Review Queue · Observatory',
    loadComponent: () =>
      import('./features/starmap/starmap-page/starmap-page').then((m) => m.StarmapPage),
  },
  { path: '**', redirectTo: '' },
];
