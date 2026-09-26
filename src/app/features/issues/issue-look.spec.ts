import { anIssue } from '../../core/issues/testing/issues-fixture';
import { IssueStar, issueFacts, lookColour, lookWords } from './issue-look';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const star = (fields: Partial<IssueStar>): IssueStar => ({
  issue: anIssue(1),
  look: 'globule',
  jets: [],
  colour: '#dc5563',
  ...fields,
});

describe('lookWords and lookColour', () => {
  it('name each body as pr-starmap does, in its own colour', () => {
    expect([lookWords(star({})), lookColour(star({}))]).toEqual([
      'Globule — nobody on it',
      '#9fe8ff',
    ]);
    expect(lookWords(star({ look: 'protostar', jets: [4] }))).toBe(
      'Protostar — 1 pull request on it',
    );
    expect(lookColour(star({ look: 'protostar' }))).toBe('#dc5563');
    expect(lookWords(star({ look: 'settled' }))).toBe('Settled — closed as completed');
    expect(lookColour(star({ look: 'settled' }))).toBe('#ffe7b0');
    const dust = star({ look: 'dust', issue: anIssue(1, { stateReason: 'DUPLICATE' }) });
    expect([lookWords(dust), lookColour(dust)]).toEqual([
      'Dust — closed as a duplicate',
      '#8d9bc4',
    ]);
  });
});

describe('issueFacts', () => {
  const day = (iso: string) => iso.slice(0, 10);

  it('reads idle past thirty days as hot, and warns of twins', () => {
    const issue = anIssue(1, {
      createdAt: '2026-08-01T12:00:00Z',
      updatedAt: '2026-08-20T12:00:00Z',
    });

    expect(issueFacts(star({ issue, jets: [4, 5] }), NOW, day)).toEqual([
      { term: 'idle', value: '37 days', isHot: true },
      { term: 'age', value: '56 days', isHot: false },
      {
        term: 'twins',
        value: '2 open pull requests close it — likely the same work twice',
        isHot: true,
      },
    ]);
  });

  it('says when a closed issue closed in place of how idle it is', () => {
    const issue = anIssue(1, { closedAt: '2026-09-20T12:00:00Z' });

    expect(issueFacts(star({ issue }), NOW, day)[0]).toEqual({
      term: 'closed',
      value: '2026-09-20',
      isHot: false,
    });
  });
});
