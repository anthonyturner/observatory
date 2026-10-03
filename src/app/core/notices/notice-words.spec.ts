import { ActivityItem } from '../activity/activity.types';
import { announcementOf, desktopNoticeOf } from './notice-words';
import { noticeDurationMs, resumedMs } from './notice-timing';

const merged = (number: number): ActivityItem => ({
  kind: 'merged',
  repo: 'me/alpha',
  label: 'alpha',
  number,
  title: `Pull ${number}`,
});

describe('announcementOf', () => {
  it('names the repository in full, so a shared display name is never ambiguous', () => {
    expect(announcementOf([merged(4)])).toBe('Pull request merged in me/alpha, #4: Pull 4.');
  });

  it('reads three items, then says how many more', () => {
    const sentence = announcementOf([merged(1), merged(2), merged(3), merged(4), merged(5)]);

    expect(sentence).toBe(
      'Pull request merged in me/alpha, #1: Pull 1; Pull request merged in me/alpha, #2: Pull 2; ' +
        'Pull request merged in me/alpha, #3: Pull 3; and 2 more.',
    );
  });
});

describe('desktopNoticeOf', () => {
  const issue = (repo: string, number: number): ActivityItem => ({
    kind: 'issue',
    repo,
    label: repo,
    number,
    title: `Issue ${number}`,
  });

  it('titles one item by its kind, and lists it as owner/repo #n · title', () => {
    expect(desktopNoticeOf('merged', [merged(4)])).toEqual({
      title: 'Pull request merged',
      body: 'me/alpha #4 · Pull 4',
      tag: 'observatory-merged-me/alpha#4',
    });
    expect(desktopNoticeOf('issue', [issue('me/beta', 9)]).title).toBe('New issue');
  });

  it('counts several in the title, lists three, then says how many more', () => {
    const notice = desktopNoticeOf('merged', [merged(1), merged(2), merged(3), merged(4)]);

    expect(notice.title).toBe('4 pull requests merged');
    expect(notice.body).toBe(
      'me/alpha #1 · Pull 1\nme/alpha #2 · Pull 2\nme/alpha #3 · Pull 3\nand 1 more',
    );
    expect(desktopNoticeOf('issue', [issue('me/beta', 1), issue('me/beta', 2)]).title).toBe(
      '2 new issues',
    );
  });

  it('tags a notice by every event in it, so the same news gets the same tag in any tab', () => {
    const items = [merged(1), merged(2), merged(3), merged(4)];

    expect(desktopNoticeOf('merged', items).tag).toBe(
      'observatory-merged-me/alpha#1,me/alpha#2,me/alpha#3,me/alpha#4',
    );
    expect(desktopNoticeOf('merged', items).tag).not.toBe(
      desktopNoticeOf('merged', [merged(1)]).tag,
    );
    expect(desktopNoticeOf('issue', [issue('me/alpha', 1)]).tag).not.toBe(
      desktopNoticeOf('merged', [merged(1)]).tag,
    );
  });
});

describe('notice timing', () => {
  it('gives ten seconds, two more for each extra row, up to twenty', () => {
    expect([1, 2, 5, 6, 12].map(noticeDurationMs)).toEqual([
      10_000, 12_000, 18_000, 20_000, 20_000,
    ]);
  });

  it('resumes with the time left, never less than four seconds', () => {
    expect([9_000, 4_000, 1_200, 0].map(resumedMs)).toEqual([9_000, 4_000, 4_000, 4_000]);
  });
});
