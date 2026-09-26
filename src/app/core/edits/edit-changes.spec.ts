import { PullDetail } from '../queue/pull-detail';
import { EditForm, canSave, changeSummary, formChanges, formOf, peopleOf } from './edit-changes';

const HEAD = 'f'.repeat(40);
const detail = {
  number: 58,
  title: 'Replace the facade',
  body: 'line one\r\nline two',
  bodyTruncated: false,
  isDraft: true,
  headOid: HEAD,
  labels: [{ name: 'bug', color: 'd73a4a' }],
  assignees: ['anthony'],
  requestedReviewers: ['sam'],
} as unknown as PullDetail;

const form = (patch: Partial<EditForm> = {}): EditForm => ({ ...formOf(detail), ...patch });

describe('formChanges', () => {
  it('asks for nothing while the form is as GitHub has it', () => {
    const asked = formChanges(form(), detail);
    expect(asked).toEqual({ changes: {}, mergeUnconfirmed: false });
    expect(changeSummary(asked, 58)).toBe('No changes.');
    expect(canSave(asked)).toBe(false);
  });

  it('does not read a textarea’s line breaks as an edit to the description', () => {
    expect(formChanges(form({ body: 'line one\nline two' }), detail).changes).toEqual({});
  });

  it('sends only what differs, the title trimmed', () => {
    const asked = formChanges(
      form({
        title: '  New title ',
        labels: new Set(['area:ci']),
        assignees: 'anthony, @me',
        reviewers: '',
        ready: true,
      }),
      detail,
    );

    expect(asked.changes).toEqual({
      title: 'New title',
      addLabels: ['area:ci'],
      removeLabels: ['bug'],
      addAssignees: ['@me'],
      removeReviewers: ['sam'],
      ready: true,
    });
    expect(changeSummary(asked, 58)).toBe(
      '6 changes ready to save: title, addLabels, removeLabels, addAssignees, removeReviewers, ready.',
    );
  });

  it('holds a merge back until its number is typed, then pins it to the commit seen', () => {
    const waiting = formChanges(form({ mergeMethod: 'squash', confirm: '5' }), detail);
    expect(waiting).toEqual({ changes: {}, mergeUnconfirmed: true });
    expect(changeSummary(waiting, 58)).toBe('Type 58 to confirm the merge.');
    expect(canSave(waiting)).toBe(false);

    const confirmed = formChanges(form({ mergeMethod: 'squash', confirm: ' 58 ' }), detail);
    expect(confirmed.changes).toEqual({ merge: { method: 'squash', headOid: HEAD } });
    expect(canSave(confirmed)).toBe(true);
  });

  it('never sends back a description that was cut to fit, nor a ready that is moot', () => {
    const cut = { ...detail, bodyTruncated: true, isDraft: false } as PullDetail;
    expect(formChanges(form({ body: 'short', ready: true }), cut).changes).toEqual({});
  });
});

describe('peopleOf', () => {
  it('reads logins from a comma-separated line', () => {
    expect(peopleOf(' a, ,b ,')).toEqual(['a', 'b']);
  });
});
