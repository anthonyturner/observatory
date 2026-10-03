import { ActivityItem, ActivityKind } from '../activity/activity.types';
import { MailAccount, MailMessage } from '../mail/mail.types';

/** Every item of one kind from one check of the tracked projects. */
export interface ActivityNotice {
  readonly id: number;
  readonly kind: ActivityKind;
  readonly items: readonly ActivityItem[];
}

/** New unread messages in one account from one read. */
export interface MailNotice {
  readonly id: number;
  readonly kind: 'mail';
  readonly account: MailAccount;
  readonly messages: readonly MailMessage[];
}

/** An account whose sign-in was refused. */
export interface MailSignInNotice {
  readonly id: number;
  readonly kind: 'mail-sign-in';
  readonly account: MailAccount;
}

/** One notice in the stack. */
export type Notice = ActivityNotice | MailNotice | MailSignInNotice;

export type NoticeKind = Notice['kind'];

/** Omits `key` from each member of a union, keeping it a union. */
type EachWithout<T, Key extends PropertyKey> = T extends unknown ? Omit<T, Key> : never;

/** A notice before the stack gives it an id. */
export type NoticeContent = EachWithout<Notice, 'id'>;

/** Where a notice's countdown line runs from, and for how long. It changes only
 *  when the countdown starts or resumes, never as it runs. */
export interface Countdown {
  /** How much of the line is left when this run starts, from 1 (full) to 0. */
  readonly fromScale: number;
  readonly ms: number;
  /** Counts up with each run, so the line restarts rather than carrying on. */
  readonly run: number;
}
