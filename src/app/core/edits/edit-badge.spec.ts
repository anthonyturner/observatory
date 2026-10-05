import { editBadgeOf } from './edit-badge';
import { EditRecord, parseEditRecord } from './edit-record';

const record = (status: EditRecord['status'], message: string): EditRecord => ({
  status,
  message,
  mergedWith: null,
  readiedAt: null,
});

describe('editBadgeOf', () => {
  it('counts the changes on their way, in pr-starmap’s words', () => {
    expect(editBadgeOf({ title: 'T' }, null)).toEqual({
      status: 'pending',
      text: '1 change sending to GitHub',
      message: '',
    });
    expect(editBadgeOf({ title: 'T', ready: true }, null)?.text).toBe(
      '2 changes sending to GitHub',
    );
  });

  it('says how the last edit went, with what happened as its tooltip', () => {
    expect(editBadgeOf(null, record('failed', 'edit failed: nope'))).toEqual({
      status: 'failed',
      text: 'edit failed',
      message: 'edit failed: nope',
    });
    expect(editBadgeOf(null, record('applied', ''))?.text).toBe('saved to GitHub');
  });

  it('shows nothing without an edit', () => {
    expect(editBadgeOf(null, null)).toBeNull();
  });
});

describe('parseEditRecord', () => {
  it('reads a record, and anything else as none', () => {
    expect(parseEditRecord({ status: 'partial', message: 'x', pr: 7 })).toEqual(
      record('partial', 'x'),
    );
    expect(parseEditRecord(null)).toBeNull();
    expect(parseEditRecord({ status: 'needs-you' })).toBeNull();
  });

  it('says how it merged and when it marked ready, only for what GitHub applied', () => {
    const sent = {
      status: 'applied',
      message: 'applied: ready, merge',
      changes: { ready: true, merge: { method: 'rebase', headOid: 'f'.repeat(40) } },
      applied: ['ready', 'merge'],
      appliedAt: '2026-10-05T09:00:00Z',
    };
    expect(parseEditRecord(sent)).toEqual({
      ...record('applied', 'applied: ready, merge'),
      mergedWith: 'rebase',
      readiedAt: '2026-10-05T09:00:00Z',
    });

    const refused = parseEditRecord({ ...sent, status: 'failed', applied: [] });
    expect([refused?.mergedWith, refused?.readiedAt]).toEqual([null, null]);
  });
});
