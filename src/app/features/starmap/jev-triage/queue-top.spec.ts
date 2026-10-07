import { QueueItem } from '../../../core/queue/queue-report';
import { nextStar } from '../next-star';
import { NamedProject } from './project-mention';
import { blockingWords, nextStarWords, topOfQueues } from './queue-top';

const ALPHA: NamedProject = { name: 'alpha', repo: 'me/alpha' };
const BETA: NamedProject = { name: 'beta', repo: 'me/beta' };

const pull = (number: number, extra: Partial<QueueItem> = {}): QueueItem => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/a/pull/${number}`,
  isDraft: false,
  bucket: 'unreviewed',
  closes: [],
  failingChecks: 0,
  flakyChecks: [],
  additions: 400,
  deletions: 0,
  idleDays: 2,
  ageDays: 5,
  branch: `h${number}`,
  base: 'main',
  mergeable: 'MERGEABLE',
  changedFiles: 3,
  isSeen: false,
  hidden: null,
  lookedSha: null,
  sinceLook: null,
  ...extra,
});

describe('topOfQueues', () => {
  it('ranks every project’s pull requests together, blocked first', () => {
    const top = topOfQueues(
      [
        { project: ALPHA, items: [pull(1, { idleDays: 30 }), pull(2, { bucket: 'failing' })] },
        { project: BETA, items: [pull(3, { bucket: 'conflicted' }), pull(4, { idleDays: 9 })] },
      ],
      3,
    );

    expect(top.map(({ project, item }) => `${project.name} ${item.pr}`)).toEqual([
      'beta 3',
      'alpha 2',
      'alpha 1',
    ]);
  });

  it('leaves out drafts and snoozed or dismissed pull requests, as Next star does', () => {
    const items = [
      pull(1, { bucket: 'conflicted', isDraft: true }),
      pull(2, { bucket: 'conflicted', hidden: { reason: 'dismissed' } }),
      pull(3),
    ];

    expect(topOfQueues([{ project: ALPHA, items }], 3).map(({ item }) => item.pr)).toEqual([3]);
  });

  it('starts with Next star’s own pick for one project with no merge plan', () => {
    const items = [
      pull(1, { bucket: 'failing', idleDays: 3 }),
      pull(2, { bucket: 'failing', idleDays: 8 }),
      pull(3, { idleDays: 40 }),
    ];

    expect(topOfQueues([{ project: ALPHA, items }], 1)[0].item.pr).toBe(nextStar(items, [])?.pr);
  });
});

describe('blockingWords', () => {
  it('reads out each with where it stands', () => {
    const top = topOfQueues(
      [
        {
          project: ALPHA,
          items: [pull(1, { bucket: 'conflicted', idleDays: 6 }), pull(2), pull(3)],
        },
      ],
      3,
    );

    expect(blockingWords(top, null)).toBe(
      'The top 3, blocked first. ' +
        '1: alpha pull request 1, “Change 1”: cannot merge, idle 6 days. ' +
        '2: alpha pull request 2, “Change 2”: waiting on you, idle 2 days. ' +
        '3: alpha pull request 3, “Change 3”: waiting on you, idle 2 days.',
    );
  });

  it('says how many there are when fewer than three', () => {
    const top = topOfQueues([{ project: ALPHA, items: [pull(1, { idleDays: 1 })] }], 3);

    expect(blockingWords(top, null)).toBe(
      'Only 1 pull request to work, blocked first. 1: alpha pull request 1, “Change 1”: waiting on you, idle 1 day.',
    );
  });

  it('says when nothing is waiting, in the project named', () => {
    expect(blockingWords([], ALPHA)).toBe(
      'Nothing is waiting in alpha: drafts, snoozed and dismissed ones aside.',
    );
  });
});

describe('nextStarWords', () => {
  it('names the pick and why, as it opens', () => {
    const [top] = topOfQueues([{ project: BETA, items: [pull(7, { bucket: 'failing' })] }], 1);

    expect(nextStarWords(top)).toBe(
      'Next star: beta pull request 7, “Change 7”, checks failing, idle 2 days. Opening it',
    );
  });
});
