import { PullDetail } from '../queue/pull-detail';
import { EditForm, canSave, changeSummary, formChanges, formOf, peopleOf } from './edit-changes';

const detail = {
  number: 58,
  title: 'Replace the facade',
  body: 'line one\r\nline two',
  bodyTruncated: false,
  labels: [{ name: 'bug', color: 'd73a4a' }],
  assignees: ['anthony'],
  requestedReviewers: ['sam'],
} as unknown as PullDetail;

const form = (patch: Partial<EditForm> = {}): EditForm => ({ ...formOf(detail), ...patch });

describe('formChanges', () => {
  it('asks for nothing while the form is as GitHub has it', () => {
    const asked = formChanges(form(), detail);
    expect(asked).toEqual({});
    expect(changeSummary(asked)).toBe('No changes.');
    expect(canSave(asked)).toBe(false);
  });

  it('does not read a textarea’s line breaks as an edit to the description', () => {
    expect(formChanges(form({ body: 'line one\nline two' }), detail)).toEqual({});
  });

  it('sends only what differs, the title trimmed', () => {
    const asked = formChanges(
      form({
        title: '  New title ',
        labels: new Set(['area:ci']),
        assignees: 'anthony, @me',
        reviewers: '',
      }),
      detail,
    );

    expect(asked).toEqual({
      title: 'New title',
      addLabels: ['area:ci'],
      removeLabels: ['bug'],
      addAssignees: ['@me'],
      removeReviewers: ['sam'],
    });
    expect(changeSummary(asked)).toBe(
      '5 changes ready to save: title, addLabels, removeLabels, addAssignees, removeReviewers.',
    );
    expect(canSave(asked)).toBe(true);
  });

  it('never sends back a description that was cut to fit', () => {
    const cut = { ...detail, bodyTruncated: true } as PullDetail;
    expect(formChanges(form({ body: 'short' }), cut)).toEqual({});
  });
});

describe('peopleOf', () => {
  it('reads logins from a comma-separated line', () => {
    expect(peopleOf(' a, ,b ,')).toEqual(['a', 'b']);
  });
});
