import { plural } from '../../shared/text/plural';
import { PullDetail } from '../queue/pull-detail';
import { EditChanges, MergeMethod } from './edit-record';

/** What the Edit tab holds as typed. */
export interface EditForm {
  readonly title: string;
  readonly body: string;
  readonly labels: ReadonlySet<string>;
  /** Logins, comma separated. */
  readonly assignees: string;
  readonly reviewers: string;
  readonly ready: boolean;
  /** Empty for "don't merge". */
  readonly mergeMethod: MergeMethod | '';
  /** The pull request's number, typed to confirm a merge. */
  readonly confirm: string;
}

/** The changes the form asks for, and whether a merge was chosen but not confirmed. */
export interface FormChanges {
  readonly changes: EditChanges;
  /** A merge was picked but its number not typed: nothing may be saved until it is. */
  readonly mergeUnconfirmed: boolean;
}

/** A textarea turns every line break into `\n`, so GitHub's `\r\n` must not read as an edit. */
const sameText = (a: string, b: string): boolean =>
  a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');

export const peopleOf = (typed: string): string[] =>
  typed
    .split(',')
    .map((login) => login.trim())
    .filter(Boolean);

function differences(
  wanted: Iterable<string>,
  current: Iterable<string>,
): { add: string[]; remove: string[] } {
  const want = new Set(wanted);
  const have = new Set(current);
  return {
    add: [...want].filter((each) => !have.has(each)),
    remove: [...have].filter((each) => !want.has(each)),
  };
}

type ListChanges = Pick<
  EditChanges,
  | 'addLabels'
  | 'removeLabels'
  | 'addAssignees'
  | 'removeAssignees'
  | 'addReviewers'
  | 'removeReviewers'
>;

function listChanges(form: EditForm, detail: PullDetail): ListChanges {
  const labels = differences(
    form.labels,
    detail.labels.map((label) => label.name),
  );
  const assignees = differences(peopleOf(form.assignees), detail.assignees);
  const reviewers = differences(peopleOf(form.reviewers), detail.requestedReviewers);
  const entries: [keyof ListChanges, string[]][] = [
    ['addLabels', labels.add],
    ['removeLabels', labels.remove],
    ['addAssignees', assignees.add],
    ['removeAssignees', assignees.remove],
    ['addReviewers', reviewers.add],
    ['removeReviewers', reviewers.remove],
  ];
  return Object.fromEntries(entries.filter(([, list]) => list.length));
}

function textChanges(form: EditForm, detail: PullDetail): Pick<EditChanges, 'title' | 'body'> {
  const title = form.title.trim();
  // A shortened description must never be sent back: it would overwrite the real one.
  const bodyChanged = !detail.bodyTruncated && !sameText(form.body, detail.body);
  return {
    ...(title && title !== detail.title ? { title } : {}),
    ...(bodyChanged ? { body: form.body } : {}),
  };
}

/** What saving the form would ask GitHub to do, as pr-starmap's editor works it out. */
export function formChanges(form: EditForm, detail: PullDetail): FormChanges {
  const confirmed = form.confirm.trim() === String(detail.number);
  const merge =
    form.mergeMethod && confirmed ? { method: form.mergeMethod, headOid: detail.headOid } : null;
  return {
    changes: {
      ...textChanges(form, detail),
      ...listChanges(form, detail),
      ...(form.ready && detail.isDraft ? { ready: true as const } : {}),
      ...(merge ? { merge } : {}),
    },
    mergeUnconfirmed: Boolean(form.mergeMethod) && !confirmed,
  };
}

/** The line beside Save: what is about to be sent, or what is still missing. */
export function changeSummary({ changes, mergeUnconfirmed }: FormChanges, number: number): string {
  if (mergeUnconfirmed) return `Type ${number} to confirm the merge.`;
  const keys = Object.keys(changes);
  return keys.length
    ? `${plural(keys.length, 'change')} ready to save: ${keys.join(', ')}.`
    : 'No changes.';
}

/** Save waits for something to send, and for a chosen merge to be confirmed. */
export const canSave = ({ changes, mergeUnconfirmed }: FormChanges): boolean =>
  !mergeUnconfirmed && Object.keys(changes).length > 0;

/** The form as GitHub has the pull request now. */
export const formOf = (detail: PullDetail): EditForm => ({
  title: detail.title,
  body: detail.body,
  labels: new Set(detail.labels.map((label) => label.name)),
  assignees: detail.assignees.join(', '),
  reviewers: detail.requestedReviewers.join(', '),
  ready: false,
  mergeMethod: '',
  confirm: '',
});
