import { plural } from '../../shared/text/plural';
import { EditChanges, EditRecord, EditStatus } from './edit-record';

/** pr-starmap's words for where an edit stands. */
export const STATUS_TEXT: Readonly<Record<EditStatus | 'pending', string>> = {
  pending: 'sending to GitHub',
  applied: 'saved to GitHub',
  partial: 'partly applied',
  failed: 'edit failed',
  rejected: 'edit rejected',
  skipped: 'skipped',
};

/** The badge under a pull request's title. */
export interface EditBadge {
  readonly status: EditStatus | 'pending';
  readonly text: string;
  /** What went wrong or what was applied, for the badge's tooltip. */
  readonly message: string;
}

/** The badge for an edit on its way, or else the last one's outcome; null for neither. */
export function editBadgeOf(
  sending: EditChanges | null,
  record: EditRecord | null,
): EditBadge | null {
  if (sending) {
    const count = Object.keys(sending).length;
    const text = `${plural(count, 'change')} ${STATUS_TEXT.pending}`;
    return { status: 'pending', text, message: '' };
  }
  if (!record) return null;
  return { status: record.status, text: STATUS_TEXT[record.status], message: record.message };
}
