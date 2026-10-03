import { Injectable, inject } from '@angular/core';
import { Observable, filter, map, scan, share } from 'rxjs';
import { MailInbox } from './mail-inbox';
import { EMPTY_MAIL_MEMORY, MailComparison, MailNews, compareMail, hasNews } from './mail-memory';

const NOTHING_COMPARED: MailComparison = {
  memory: EMPTY_MAIL_MEMORY,
  news: { newMail: [], signInFailed: [] },
};

/**
 * New unread mail, and refused sign-ins, found by comparing each read of both
 * inboxes with the ones before. It adds no timer of its own: it follows the
 * shared inbox, which reads only on this machine.
 */
@Injectable({ providedIn: 'root' })
export class MailWatch {
  /** Each read's news; a read with none emits nothing. */
  readonly news: Observable<MailNews> = inject(MailInbox).rounds.pipe(
    scan((last: MailComparison, reports) => compareMail(last.memory, reports), NOTHING_COMPARED),
    map((comparison) => comparison.news),
    filter(hasNews),
    share(),
  );
}
