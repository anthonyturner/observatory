import { ActivityItem } from '../activity/activity.types';
import { announcementOf, sayingOf } from './notice-words';
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

describe('sayingOf', () => {
  const issue = (number: number, title: string): ActivityItem => ({
    kind: 'issue',
    repo: 'me/beta',
    label: 'beta',
    number,
    title,
  });

  it('names the project as shown and the title, with no "#" or owner', () => {
    expect(sayingOf([{ ...merged(12), title: 'Transport bar fix' }])).toBe(
      'Pull request 12 in alpha merged: Transport bar fix.',
    );
    expect(sayingOf([issue(7, 'Crash on load')])).toBe('New issue 7 in beta: Crash on load.');
  });

  it('makes several items one line, a sentence each', () => {
    expect(sayingOf([merged(4), issue(7, 'Crash on load')])).toBe(
      'Pull request 4 in alpha merged: Pull 4. New issue 7 in beta: Crash on load.',
    );
  });

  it('keeps a title’s own full stop, question or exclamation mark', () => {
    expect(sayingOf([issue(1, 'Why is it slow?  ')])).toBe('New issue 1 in beta: Why is it slow?');
  });

  it('says three items, then how many more', () => {
    expect(sayingOf([merged(1), merged(2), merged(3), merged(4), merged(5)])).toBe(
      'Pull request 1 in alpha merged: Pull 1. Pull request 2 in alpha merged: Pull 2. ' +
        'Pull request 3 in alpha merged: Pull 3. And 2 more.',
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
