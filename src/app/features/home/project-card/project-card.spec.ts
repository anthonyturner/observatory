import { TestBed } from '@angular/core/testing';
import { ProjectJump } from '../../../core/projects/project-jump';
import { ProjectSnapshot } from '../../../core/projects/project.types';
import { ProjectCard } from './project-card';

const blocked: ProjectSnapshot = {
  name: 'pr-starmap',
  repo: 'me/pr-starmap',
  dashboardUrl: '/p/me/pr-starmap',
  open: 2,
  counts: { conflicted: 1, failing: 0, unknown: 0, unlinked: 0, unreviewed: 1, unclaimed: 0 },
};

function render(project: ProjectSnapshot): HTMLElement {
  const fixture = TestBed.createComponent(ProjectCard);
  fixture.componentRef.setInput('project', project);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ProjectCard', () => {
  it('shows the worst problem, the counts and the way in', () => {
    const card = render(blocked);

    expect(card.querySelector('.kind')?.textContent).toBe('Blocked');
    expect(card.querySelector('.name a')?.getAttribute('href')).toBe('/p/me/pr-starmap');
    expect(card.querySelectorAll('.count').length).toBe(2);
    expect(card.querySelector('.github')?.getAttribute('href')).toBe(
      'https://github.com/me/pr-starmap',
    );
    expect(card.style.getPropertyValue('--sev')).toBe('var(--sev-blocked)');
  });

  it('says counts are unknown, and shows none, when GitHub could not be read', () => {
    const card = render({ ...blocked, error: 'rate limited' });

    expect(card.querySelector('.unknown')?.textContent).toContain('Counts unknown, not zero.');
    expect(card.querySelector('.counts')).toBeNull();
  });

  it('comes into view, lit and focused, when its dot is clicked', () => {
    Element.prototype.scrollIntoView ??= () => undefined;
    const fixture = TestBed.createComponent(ProjectCard);
    fixture.componentRef.setInput('project', blocked);
    fixture.detectChanges();
    const card = fixture.nativeElement as HTMLElement;
    document.body.append(card);

    TestBed.inject(ProjectJump).jumpTo('me/pr-starmap');
    fixture.detectChanges();

    expect(card.classList).toContain('flash');
    expect(document.activeElement).toBe(card.querySelector('.name a'));
    card.remove();
  });

  it('ignores a jump to another project', () => {
    const fixture = TestBed.createComponent(ProjectCard);
    fixture.componentRef.setInput('project', blocked);
    fixture.detectChanges();

    TestBed.inject(ProjectJump).jumpTo('me/other');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).classList).not.toContain('flash');
  });
});
