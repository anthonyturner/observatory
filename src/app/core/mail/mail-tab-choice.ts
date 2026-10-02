import { Injectable, signal } from '@angular/core';
import { MAIL_ACCOUNTS, MailAccount } from './mail.types';

const STORAGE_KEY = 'observatory.mail-tab';

/** The Mail tab last picked in this browser; null until one is. */
@Injectable({ providedIn: 'root' })
export class MailTabChoice {
  private readonly picked = signal<MailAccount | null>(readStoredTab());

  readonly chosen = this.picked.asReadonly();

  choose(account: MailAccount): void {
    this.picked.set(account);
    storeTab(account);
  }
}

/** Private windows and blocked site data throw here; the default tab then holds. */
function readStoredTab(): MailAccount | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return MAIL_ACCOUNTS.find((account) => account === stored) ?? null;
  } catch {
    return null;
  }
}

/** Where storage is blocked the choice lasts for this visit only, which is still useful. */
function storeTab(account: MailAccount): void {
  try {
    localStorage.setItem(STORAGE_KEY, account);
  } catch {
    return;
  }
}
