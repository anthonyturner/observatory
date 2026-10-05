import { EditRecord } from '../../../../core/edits/edit-record';
import { CheckLine, PullDetail } from '../../../../core/queue/pull-detail';
import { checksRow, mergeBoxOf } from './merge-box-view';

const FETCHED = '2026-10-05T09:00:00Z';
const detail = {
  state: 'open',
  isDraft: false,
  mergeable: 'MERGEABLE',
  reviewDecision: 'approved',
  checks: [{ run: 'build', result: 'SUCCESS' }],
  fetchedAt: FETCHED,
} as unknown as PullDetail;

const pull = (patch: Partial<PullDetail>): PullDetail => ({ ...detail, ...patch });
const record = (patch: Partial<EditRecord>): EditRecord => ({
  status: 'applied',
  message: '',
  mergedWith: null,
  readiedAt: null,
  ...patch,
});
const check = (result: string): CheckLine => ({ run: result, result });

describe('mergeBoxOf', () => {
  it('offers a merge when nothing stands in the way', () => {
    expect(mergeBoxOf({ detail, record: null })).toEqual({
      ending: null,
      isDraft: false,
      rows: [
        { key: 'conflicts', tone: 'ok', text: 'No conflicts with the base branch' },
        { key: 'checks', tone: 'ok', text: '1 check passed' },
        { key: 'review', tone: 'ok', text: 'Approved' },
      ],
      blockedBy: null,
    });
  });

  it('holds a draft back and says why', () => {
    const view = mergeBoxOf({ detail: pull({ isDraft: true }), record: null });

    expect(view.isDraft).toBe(true);
    expect(view.rows[0]).toEqual({ key: 'draft', tone: 'meh', text: 'Still a draft' });
    expect(view.blockedBy).toBe('Mark it ready for review to merge.');
  });

  it('holds a conflicting branch back, and words the review decision', () => {
    const view = mergeBoxOf({
      detail: pull({ mergeable: 'CONFLICTING', reviewDecision: 'changes-requested' }),
      record: null,
    });

    expect(view.rows.map((row) => row.tone)).toEqual(['bad', 'ok', 'bad']);
    expect(view.blockedBy).toBe('Resolve the conflicts to merge.');
    expect(mergeBoxOf({ detail: pull({ mergeable: 'UNKNOWN' }), record: null }).rows[0].tone).toBe(
      'meh',
    );
  });

  it('trusts a ready it sent only when it came after the details were read', () => {
    const draft = pull({ isDraft: true });
    const later = record({ readiedAt: '2026-10-05T09:01:00Z' });
    const earlier = record({ readiedAt: '2026-10-05T08:59:00Z' });

    expect(mergeBoxOf({ detail: draft, record: later }).isDraft).toBe(false);
    expect(mergeBoxOf({ detail: draft, record: earlier }).isDraft).toBe(true);
  });

  it('ends in merged or closed, from GitHub or from its own merge before any refetch', () => {
    const ending = (patch: Partial<PullDetail>, last: EditRecord | null = null) =>
      mergeBoxOf({ detail: pull(patch), record: last }).ending;

    expect(ending({}, record({ mergedWith: 'squash' }))).toEqual({
      state: 'merged',
      text: 'Merged ✓ via squash',
    });
    expect(ending({ state: 'merged' })).toEqual({ state: 'merged', text: 'Merged ✓' });
    expect(ending({ state: 'closed' })).toEqual({
      state: 'closed',
      text: 'Closed without merging',
    });
    expect(ending({}, record({ status: 'failed' }))).toBeNull();
  });
});

describe('checksRow', () => {
  it('reports failures first, then what is still running', () => {
    expect(checksRow([])).toEqual({ key: 'checks', tone: 'meh', text: 'No checks ran' });
    expect(checksRow([check('SUCCESS'), check('FAILURE'), check('IN_PROGRESS')]).text).toBe(
      '1 of 3 checks failed',
    );
    expect(checksRow([check('SUCCESS'), check('QUEUED')]).text).toBe('1 of 2 checks still running');
    expect(checksRow([check('SUCCESS'), check('SKIPPED')]).text).toBe('2 checks passed');
  });
});
