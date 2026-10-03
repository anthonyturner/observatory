import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ActivityWatch } from '../activity/activity-watch';
import { ActivityItem } from '../activity/activity.types';
import { BROWSER_NOTICES } from '../agent-usage/browser-notices';
import { FakeBrowserNotices } from '../agent-usage/testing/fake-browser-notices';
import { PageVisibility } from '../presence/page-visibility';
import { DesktopNotices } from './desktop-notices';
import { ProjectNotifyPreference } from './project-notify-preference';

const merged = (number: number): ActivityItem => ({
  kind: 'merged',
  repo: 'me/alpha',
  label: 'alpha',
  number,
  title: `Pull ${number}`,
});
const issue = (number: number): ActivityItem => ({
  kind: 'issue',
  repo: 'me/beta',
  label: 'beta',
  number,
  title: `Issue ${number}`,
});

interface Options {
  readonly isOn?: boolean;
  readonly isHidden?: boolean;
}

function setUp({ isOn = true, isHidden = true }: Options = {}) {
  const checks = new Subject<readonly ActivityItem[]>();
  const notices = new FakeBrowserNotices('granted');
  TestBed.configureTestingModule({
    providers: [
      { provide: ActivityWatch, useValue: { checks } },
      { provide: BROWSER_NOTICES, useValue: notices },
      { provide: PageVisibility, useValue: { isHidden: signal(isHidden) } },
      { provide: ProjectNotifyPreference, useValue: { isOn: signal(isOn) } },
    ],
  });
  TestBed.inject(DesktopNotices);
  return { check: (...items: ActivityItem[]) => checks.next(items), notices };
}

describe('DesktopNotices', () => {
  it('sends one notification per kind from a check while the tab is hidden', () => {
    const { check, notices } = setUp();

    check(merged(10), merged(11), issue(7));

    expect(notices.shown).toEqual([
      {
        title: '2 pull requests merged',
        body: 'me/alpha #10 · Pull 10\nme/alpha #11 · Pull 11',
        tag: 'observatory-merged-me/alpha#10,me/alpha#11',
      },
      { title: 'New issue', body: 'me/beta #7 · Issue 7', tag: 'observatory-issue-me/beta#7' },
    ]);
  });

  it('sends none with the tab in front, where the notices on the page say it', () => {
    const { check, notices } = setUp({ isHidden: false });

    check(merged(10));

    expect(notices.shown).toEqual([]);
  });

  it('sends none unless Notify me is on', () => {
    const { check, notices } = setUp({ isOn: false });

    check(merged(10));

    expect(notices.shown).toEqual([]);
  });

  it('sends none once the browser no longer allows them, even before the box shows it', () => {
    const { check, notices } = setUp();
    notices.setPermission('denied');

    check(merged(10));

    expect(notices.shown).toEqual([]);
  });
});
