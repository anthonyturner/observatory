import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { projectTabSections } from './project-tab-sections';
import { PROJECT_TABS } from './project-tabs';
import { QuietTab } from './quiet-tab';
import { QUIET_TABS } from './quiet-tabs';
import { TAB_BADGES, TabBadge } from './tab-badge';

function sectionsFor(
  providers: { badges?: TabBadge[]; quiet?: QuietTab[] },
  initial: { repo: string; current: string },
) {
  TestBed.configureTestingModule({
    providers: [
      { provide: TAB_BADGES, useValue: providers.badges ?? [] },
      { provide: QUIET_TABS, useValue: providers.quiet ?? [] },
    ],
  });
  const repo = signal(initial.repo);
  const current = signal(initial.current);
  const sections = TestBed.runInInjectionContext(() => projectTabSections(repo, current));
  const read = () => {
    TestBed.tick();
    return sections();
  };
  const section = (id: string) => read().find((one) => one.id === id);
  return { repo, current, read, section };
}

describe('projectTabSections', () => {
  it('has a section for every screen of the project, in order, each linked below the project', () => {
    const { read } = sectionsFor({}, { repo: 'me/app', current: 'releases' });

    expect(read().map(({ id, label, link }) => [id, label, link])).toEqual(
      PROJECT_TABS.map((tab) => [
        tab.id,
        tab.label,
        tab.path ? `/p/me/app/${tab.path}` : '/p/me/app',
      ]),
    );
  });

  it('marks the current screen, and follows it when it changes', () => {
    const { current, read } = sectionsFor({}, { repo: 'me/app', current: 'releases' });

    expect(
      read()
        .filter((section) => section.isCurrent)
        .map((section) => section.id),
    ).toEqual(['releases']);

    current.set('journal');
    expect(
      read()
        .filter((section) => section.isCurrent)
        .map((section) => section.id),
    ).toEqual(['journal']);
  });

  it('marks none as current when the screen is none of the tabs', () => {
    const { read } = sectionsFor({}, { repo: 'me/app', current: '' });

    expect(read().some((section) => section.isCurrent)).toBe(false);
  });

  it('lets a tab recede for a project with nothing on it', () => {
    const empty: QuietTab = { tabId: 'milestones', isEmpty: (repo) => of(repo === 'me/bare') };
    const { repo, read, section } = sectionsFor(
      { quiet: [empty] },
      { repo: 'me/bare', current: 'queue' },
    );

    expect(section('milestones')?.isQuiet).toBe(true);
    expect(read().filter((one) => one.isQuiet)).toHaveLength(1);

    repo.set('me/app');
    expect(section('milestones')?.isQuiet).toBe(false);
  });

  it('gives a badge’s count to its tab, read out with its noun, and none for a count of none', () => {
    const counts: Record<string, number | null> = { 'me/app': 3, 'me/calm': 0 };
    const badge: TabBadge = {
      tabId: 'security',
      noun: 'open alert',
      count: (repo) => of(counts[repo] ?? null),
    };
    const { repo, section } = sectionsFor(
      { badges: [badge] },
      { repo: 'me/app', current: 'queue' },
    );

    expect(section('security')?.badge).toEqual({ shown: '3', spoken: '3 open alerts' });
    expect(section('queue')?.badge).toBeUndefined();

    repo.set('me/calm');
    expect(section('security')?.badge).toBeUndefined();
  });

  it('asks each badge once however many screens read the sections', () => {
    const count = vi.fn(() => of(3));
    const { read } = sectionsFor(
      { badges: [{ tabId: 'security', noun: 'open alert', count }] },
      { repo: 'me/app', current: 'queue' },
    );

    read();
    read();

    expect(count).toHaveBeenCalledOnce();
  });
});
