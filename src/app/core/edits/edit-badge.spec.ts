import { editBadgeOf } from './edit-badge';
import { parseEditRecord } from './edit-record';

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
    expect(editBadgeOf(null, { status: 'failed', message: 'edit failed: nope' })).toEqual({
      status: 'failed',
      text: 'edit failed',
      message: 'edit failed: nope',
    });
    expect(editBadgeOf(null, { status: 'applied', message: '' })?.text).toBe('saved to GitHub');
  });

  it('shows nothing without an edit', () => {
    expect(editBadgeOf(null, null)).toBeNull();
  });
});

describe('parseEditRecord', () => {
  it('reads a record, and anything else as none', () => {
    expect(parseEditRecord({ status: 'partial', message: 'x', pr: 7 })).toEqual({
      status: 'partial',
      message: 'x',
    });
    expect(parseEditRecord(null)).toBeNull();
    expect(parseEditRecord({ status: 'needs-you' })).toBeNull();
  });
});
