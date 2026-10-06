import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scanSource } from './source-scan.ts';

describe('routes', () => {
  it('reads eager, lazy and child routes, and skips a redirect', () => {
    const { routes } = scanSource(
      'app.routes.ts',
      `export const routes: Routes = [
        { path: '', component: WaitingComponent, pathMatch: 'full' },
        { path: 'face', loadComponent: () => import('./face/face').then((m) => m.FaceComponent) },
        { path: 'alarms', loadChildren: () => import('./alarms/alarm.routes').then(m => m.alarmRoutes) },
        { path: '**', redirectTo: '/face' },
      ];`,
    );
    assert.deepEqual(routes, [
      { path: '', component: { name: 'WaitingComponent', module: null }, children: null },
      { path: 'face', component: { name: 'FaceComponent', module: './face/face' }, children: null },
      { path: 'alarms', component: null, children: './alarms/alarm.routes' },
    ]);
  });
});

describe('case routes', () => {
  it('pairs each string case with the path it navigates to', () => {
    const { caseRoutes } = scanSource(
      'shell.ts',
      `switch (name) {
        case 'wall': this.router.navigate(['/face']); break;
        case 'pocket': router.navigateByUrl('/alarms'); break;
        case 'silent': log(); break;
        default: this.router.navigate(['/face']);
      }`,
    );
    assert.deepEqual(caseRoutes, [
      { label: 'wall', path: 'face' },
      { label: 'pocket', path: 'alarms' },
    ]);
  });
});
