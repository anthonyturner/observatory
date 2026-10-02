import { type Environment, LOCAL_ENV_FILE, localSetting } from '../util/local-setting.ts';
import type { MailAccount } from './mail-types.ts';

/** How to sign in to one inbox. */
export interface MailLogin {
  readonly address: string;
  /** An app password, never the account's own password. */
  readonly password: string;
}

/** Each account's settings, by name. Specific to Observatory, so a machine-wide
 *  variable set for another tool cannot stand in for them. */
export const MAIL_ENV: Readonly<
  Record<MailAccount, { readonly address: string; readonly password: string }>
> = {
  icloud: { address: 'ICLOUD_MAIL_ADDRESS', password: 'ICLOUD_MAIL_APP_PASSWORD' },
  gmail: { address: 'GMAIL_ADDRESS', password: 'GMAIL_APP_PASSWORD' },
};

/** Google shows an app password in four groups of four, and people paste the spaces too. */
const SPACES = /\s+/g;

/** One account's login on this machine, each setting from the environment
 *  first, then the file; null unless both are set. */
export function localMailLogin(
  account: MailAccount,
  env: Environment = process.env,
  file = LOCAL_ENV_FILE,
): MailLogin | null {
  const names = MAIL_ENV[account];
  const address = localSetting(names.address, env, file)?.trim();
  const password = localSetting(names.password, env, file)?.replace(SPACES, '');
  return address && password ? { address, password } : null;
}
