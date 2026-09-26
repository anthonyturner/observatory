import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProjectSnapshot } from '../../../core/projects/project.types';
import { ProjectsState } from '../../../core/projects/projects-feed';
import { PROJECTS_STATE } from '../../../core/projects/projects-source';
import { FleetSection } from './fleet-section';

const quiet = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (name: string, failing = 0): ProjectSnapshot => ({
  name,
  repo: `me/${name}`,
  dashboardUrl: `/p/me/${name}`,
  open: 0,
  counts: { ...quiet, failing },
});
const ready = (projects: readonly ProjectSnapshot[]): ProjectsState => ({
  status: 'ready',
  report: { generatedAt: '2026-09-26T12:00:00Z', projects, directives: [] },
});

function render(state: ProjectsState): HTMLElement {
  TestBed.configureTestingModule({
    providers: [{ provide: PROJECTS_STATE, useValue: signal(state) }],
  });
  const fixture = TestBed.createComponent(FleetSection);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('FleetSection', () => {
  it('puts blocked projects first and sums them up', () => {
    const element = render(ready([project('calm'), project('stuck', 2)]));

    const names = Array.from(element.querySelectorAll('.name a')).map((a) => a.textContent?.trim());
    expect(names).toEqual(['stuck', 'calm']);
    expect(element.querySelector('.sum')?.textContent).toBe('1 blocked · 1 clear');
  });

  it('says it is reading, and shows no cards, before the first read', () => {
    const element = render({ status: 'reading' });

    expect(element.querySelector('.empty')?.textContent).toContain('Reading your projects');
    expect(element.querySelector('app-project-card')).toBeNull();
  });

  it('says the projects are out of reach rather than showing none', () => {
    expect(render({ status: 'unreachable' }).querySelector('.empty')?.textContent).toContain(
      'out of reach',
    );
  });

  it('says so when the account owns no repositories', () => {
    expect(render(ready([])).querySelector('.empty')?.textContent).toContain('No projects yet');
  });
});
