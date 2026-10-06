import { QueueItem } from '../../../core/queue/queue-report';
import { cardFacts } from './card-facts';

const item: QueueItem = {
  number: 58,
  title: 'Replace the facade',
  url: 'https://github.com/me/a/pull/58',
  isDraft: true,
  bucket: 'conflicted',
  closes: [57],
  failingChecks: 0,
  additions: 96,
  deletions: 95,
  idleDays: 49,
  ageDays: 58,
  branch: 'refactor/57',
  base: 'main',
  mergeable: 'CONFLICTING',
  changedFiles: 4,
  isSeen: false,
  hidden: null,
  lookedSha: null,
  sinceLook: null,
};

const words = (facts: ReturnType<typeof cardFacts>) => facts.map((f) => `${f.term}: ${f.value}`);

describe('cardFacts', () => {
  it('says what pr-starmap’s card says, in its order', () => {
    expect(words(cardFacts(item, { pairs: [], binaries: [] }))).toEqual([
      'size: +96 −95 · 4 files',
      'closes: #57',
      'idle: 49 days',
      'age: 58 days',
      'branch: refactor/57',
      'state: draft · conflicting',
    ]);
  });

  it('leads with collisions and binaries, and marks what is bad', () => {
    const facts = cardFacts(
      { ...item, closes: [], additions: 10, deletions: 2, bucket: 'unreviewed', changedFiles: 1 },
      {
        pairs: [
          { a: 58, b: 85, conflict: true },
          { a: 12, b: 58, conflict: null },
          { a: 58, b: 90, conflict: false },
        ],
        binaries: [{ issue: 57, others: [85] }],
      },
    );

    expect(facts.slice(0, 3).map((f) => [f.term, f.value, f.tone])).toEqual([
      ['collides', '#85', 'bad'],
      ['shares files', '#12, #90', undefined],
      ['binary', '#85 also closes #57', 'hot'],
    ]);
    expect(facts.find((f) => f.term === 'size')?.value).toBe('+10 −2 · 1 file · quick win');
    expect(facts.find((f) => f.term === 'closes')).toEqual({
      term: 'closes',
      value: 'nothing',
      tone: 'bad',
    });
  });

  it('leaves the size out when GitHub did not give one', () => {
    const facts = cardFacts({ ...item, additions: null }, { pairs: [], binaries: [] });
    expect(facts.some((f) => f.term === 'size')).toBe(false);
  });
});
