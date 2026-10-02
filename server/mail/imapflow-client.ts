import { ImapFlow } from 'imapflow';
import type { ImapClient, ImapClientOptions } from './imap-inbox.ts';

/** A real IMAP connection, from the `imapflow` library. */
export const imapflowClient = (options: ImapClientOptions): ImapClient => new ImapFlow(options);
