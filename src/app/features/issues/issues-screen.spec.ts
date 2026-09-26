import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IssuesFeed, IssuesState } from '../../core/issues/issues-feed';
import { aReport, anIssue } from '../../core/issues/testing/issues-fixture';
import { IssuesScreen } from './issues-screen';

function screen(state: IssuesState) {
  const feed = { state: signal(state), watch: vi.fn(), refresh: vi.fn() };
  TestBed.configureTestingModule({
    providers: [IssuesScreen, { provide: IssuesFeed, useValue: feed }],
  });
  return { issues: TestBed.inject(IssuesScreen), feed };
}

const ready = (): IssuesState => ({
  status: 'ready',
  report: aReport([anIssue(1), anIssue(2, { comet: false })], [anIssue(3, { comet: false })]),
});

describe('IssuesScreen', () => {
  it('stamps the issues as pr-starmap does, and counts the comets in the legend', () => {
    const { issues } = screen(ready());

    expect(issues.stamp()).toMatch(/^me\/a · 2 open · 1 closed in 60 days · refreshed /);
    expect(issues.chips()).toEqual([
      { id: 'comet', colour: '#9fe8ff', count: 1, text: 'nobody on it', live: true },
    ]);
    expect(issues.counts()).toEqual({ open: '2', closed: '1' });
  });

  it('says nothing has been read yet', () => {
    const { issues } = screen({ status: 'reading' });

    expect(issues.stamp()).toBe('no issues read yet');
    expect(issues.message()?.headline).toBe('No issues read yet.');
    expect(issues.chips()[0].live).toBe(false);
  });

  it('brings the Open list up for the comets, and drops them for Closed', () => {
    const { issues } = screen(ready());
    issues.setTab('closed');

    issues.toggleComets();
    expect([issues.tab(), issues.filter()]).toEqual(['open', 'comet']);
    issues.setTab('closed');
    expect([issues.tab(), issues.filter()]).toEqual(['closed', null]);
  });

  it('opens on the tab the address names, and names it back', () => {
    const { issues } = screen(ready());

    issues.openAt('issues/closed');
    expect(issues.fragment()).toBe('issues/closed');
    issues.openAt('issues');
    expect(issues.fragment()).toBe('issues');
  });

  it('starts a new repository afresh', () => {
    const { issues, feed } = screen(ready());
    issues.label.set('bug');
    issues.query.set('x');

    issues.watch('me/b');

    expect([issues.label(), issues.query()]).toEqual(['', '']);
    expect(feed.watch).toHaveBeenCalledWith('me/b');
  });
});
