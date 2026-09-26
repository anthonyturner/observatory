import { TestBed } from '@angular/core/testing';
import { ProjectSnapshot } from '../../../core/projects/project.types';
import { layoutWorlds } from '../../../core/orrery/world-layout';
import { WorldCard } from './world-card';

const project: ProjectSnapshot = {
  name: 'rivals_pulse',
  repo: 'me/rivals_pulse',
  dashboardUrl: '/p/me/rivals_pulse',
  open: 3,
  issues: 5,
  oldestIdleDays: 12,
  counts: { conflicted: 2, failing: 0, unknown: 0, unlinked: 1, unreviewed: 0, unclaimed: 0 },
};

function render(snapshot: ProjectSnapshot) {
  const fixture = TestBed.createComponent(WorldCard);
  fixture.componentRef.setInput('world', layoutWorlds([snapshot])[0]);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('WorldCard', () => {
  it('shows the worst problem, the counts and the totals', () => {
    const { element } = render(project);

    expect(element.querySelector('.kind')?.textContent).toBe('Blocked');
    expect(element.querySelector('h2')?.textContent).toBe('rivals_pulse');
    expect(element.querySelectorAll('.count').length).toBe(2);
    expect(element.querySelector('.totals')?.textContent).toContain(
      'days since the oldest was touched',
    );
    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      'https://github.com/me/rivals_pulse/pulls',
    );
  });

  it('asks to open the review queue, to show the project on Home, and to close', () => {
    const { fixture, element } = render(project);
    const shown: string[] = [];
    const opened: string[] = [];
    let closed = 0;
    fixture.componentInstance.showOnHome.subscribe((repo) => shown.push(repo));
    fixture.componentInstance.openQueue.subscribe((repo) => opened.push(repo));
    fixture.componentInstance.closed.subscribe(() => closed++);
    const button = (words: string) =>
      Array.from(element.querySelectorAll<HTMLButtonElement>('.actions button')).find((b) =>
        b.textContent?.includes(words),
      );

    button('Review queue')?.click();
    button('Show on Home')?.click();
    element.querySelector<HTMLButtonElement>('.close')?.click();

    expect(opened).toEqual(['me/rivals_pulse']);
    expect(shown).toEqual(['me/rivals_pulse']);
    expect(closed).toBe(1);
  });

  it('says counts are unknown for a project GitHub could not read', () => {
    const { element } = render({ ...project, error: 'rate limited' });

    expect(element.querySelector('.unknown')?.textContent).toContain('Counts unknown, not zero.');
    expect(element.querySelector('.counts')).toBeNull();
  });
});
