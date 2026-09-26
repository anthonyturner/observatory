import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProjectSnapshot } from '../../../core/projects/project.types';
import { PROJECTS } from '../../../core/projects/projects-source';
import { FleetSection } from './fleet-section';

const quiet = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (name: string, failing = 0): ProjectSnapshot => ({
  name,
  repo: `me/${name}`,
  dashboardUrl: `/p/me/${name}`,
  open: 0,
  counts: { ...quiet, failing },
});

function render(projects: readonly ProjectSnapshot[]): HTMLElement {
  TestBed.configureTestingModule({
    providers: [{ provide: PROJECTS, useValue: signal(projects) }],
  });
  const fixture = TestBed.createComponent(FleetSection);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('FleetSection', () => {
  it('puts blocked projects first and sums them up', () => {
    const element = render([project('calm'), project('stuck', 2)]);

    const names = Array.from(element.querySelectorAll('.name a')).map((a) => a.textContent?.trim());
    expect(names).toEqual(['stuck', 'calm']);
    expect(element.querySelector('.sum')?.textContent).toBe('1 blocked · 1 clear');
  });

  it('says so when there are no projects', () => {
    expect(render([]).querySelector('.empty')?.textContent).toContain('No projects charted yet.');
  });
});
