import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { ProjectSnapshot } from '../../../core/projects/project.types';
import { ProjectsState } from '../../../core/projects/projects-feed';
import { PROJECTS_STATE } from '../../../core/projects/projects-source';
import { OrreryCanvas } from '../orrery-canvas/orrery-canvas';
import { OrreryPage } from './orrery-page';

const quiet = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (name: string, open = 0): ProjectSnapshot => ({
  name,
  repo: `me/${name}`,
  dashboardUrl: `/p/me/${name}`,
  open,
  counts: quiet,
});
const ready = (projects: ProjectSnapshot[]): ProjectsState => ({
  status: 'ready',
  report: { generatedAt: new Date().toISOString(), projects, directives: [] },
});

const buttonNamed = (element: HTMLElement, words: string) =>
  Array.from(element.querySelectorAll<HTMLButtonElement>('app-world-card .actions button')).find(
    (button) => button.textContent?.includes(words),
  );

function render(state: ProjectsState) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: PROJECTS_STATE, useValue: signal(state) }],
  });
  const fixture = TestBed.createComponent(OrreryPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('OrreryPage', () => {
  it('explains the system from its Help button and ?', () => {
    const { fixture, element } = render(ready([project('a', 2)]));

    element.querySelector<HTMLButtonElement>('app-help-button button')?.click();
    fixture.detectChanges();
    expect(element.querySelector('#help-title')?.textContent).toBe('Orrery');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    fixture.detectChanges();
    expect(element.querySelector('#help-title')).toBeNull();
  });

  it('names the system and links back to Home', () => {
    const { element } = render(ready([project('a', 2), project('b', 3)]));

    expect(element.querySelector('h1')?.textContent).toBe('Orrery');
    expect(element.querySelector('.stamp')?.textContent).toContain('2 worlds · 5 open');
    expect(element.querySelector('a.home')?.getAttribute('href')).toBe('/');
  });

  it('says it is reading instead of drawing an empty system', () => {
    expect(render({ status: 'reading' }).element.querySelector('.state')?.textContent).toContain(
      'Reading your projects',
    );
  });

  it('opens Home at a project’s card when asked from its world', () => {
    const { fixture, element } = render(ready([project('a', 2)]));
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const canvas = fixture.debugElement.query(By.directive(OrreryCanvas));
    (canvas.componentInstance as OrreryCanvas).selected.set('me/a');
    fixture.detectChanges();
    buttonNamed(element, 'Show on Home')?.click();

    expect(navigate).toHaveBeenCalledWith(['/'], { queryParams: { project: 'me/a' } });
  });

  it('opens a world’s review queue from its card', () => {
    const { fixture, element } = render(ready([project('a', 2)]));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const canvas = fixture.debugElement.query(By.directive(OrreryCanvas));
    (canvas.componentInstance as OrreryCanvas).selected.set('me/a');
    fixture.detectChanges();
    buttonNamed(element, 'Review queue')?.click();

    expect(navigate).toHaveBeenCalledWith('/p/me/a');
  });
});
