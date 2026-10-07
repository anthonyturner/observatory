import { Routes } from '@angular/router';

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
    path: 'p/:owner/:repo',
    title: 'Review Queue · Observatory',
    loadComponent: () =>
      import('./features/starmap/starmap-page/starmap-page').then((m) => m.StarmapPage),
  },
  { path: '**', redirectTo: '' },
];
