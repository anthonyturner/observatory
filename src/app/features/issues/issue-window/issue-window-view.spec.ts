import { anIssue } from '../../../core/issues/testing/issues-fixture';
import { barLabelOf, kickerOf, metaLineOf } from './issue-window-view';

const NOW = Date.parse('2026-09-26T12:00:00Z');

describe('kickerOf', () => {
  it('says how a closed issue closed, abandoned work in the faint ink', () => {
    const closedAt = '2026-09-20T12:00:00Z';

    expect(kickerOf(anIssue(1, { closedAt, stateReason: 'NOT_PLANNED' }))).toEqual({
      text: expect.stringMatching(/^Issue · Closed — not planned · /),
      state: 'Closed',
      colour: 'var(--faint)',
      ink: 'var(--muted)',
    });
    expect(kickerOf(anIssue(1, { closedAt, stateReason: 'DUPLICATE' })).text).toMatch(
      /^Issue · Closed — duplicate · /,
    );
    expect(kickerOf(anIssue(1, { closedAt, stateReason: 'COMPLETED' }))).toEqual({
      text: expect.stringMatching(/^Issue · Completed — closed /),
      state: 'Completed',
      colour: 'var(--ok)',
      ink: null,
    });
  });

  it('names an open issue by who is on it', () => {
    expect(kickerOf(anIssue(1)).text).toBe('Issue · Comet — no pull request closes it');
    expect(kickerOf(anIssue(1, { comet: false, prs: [4, 5] })).text).toBe(
      'Issue · Open — 2 pull requests on it',
    );
    expect(kickerOf(anIssue(1, { comet: false })).text).toBe('Issue · Open');
    expect(kickerOf({ number: 1 }).text).toBe('Issue');
  });

  it('shortens to the kind and state for the bar a phone pins', () => {
    expect(barLabelOf(12, kickerOf(anIssue(12)))).toBe('Issue #12 · Comet');
    expect(barLabelOf(12, kickerOf({ number: 12 }))).toBe('Issue #12');
  });
});

describe('metaLineOf', () => {
  it('says who opened an open issue, how old it is and how long it has sat', () => {
    const line = metaLineOf(
      anIssue(1, { createdAt: '2026-09-01T12:00:00Z', updatedAt: '2026-09-20T12:00:00Z' }),
      NOW,
    );

    expect(line).toMatch(/^opened .+ by @me · 25 days old · idle 6 days$/);
  });

  it('says when a closed issue closed, and a deleted author is ghost', () => {
    const line = metaLineOf(anIssue(1, { closedAt: '2026-09-20T12:00:00Z', author: null }), NOW);

    expect(line).toMatch(/^opened .+ by @ghost · closed .+$/);
  });

  it('leaves out what is not known yet', () => {
    expect(metaLineOf({ number: 3 }, NOW)).toBe('');
  });
});
