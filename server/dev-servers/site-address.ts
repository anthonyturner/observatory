import { isLocalLine, localUrlIn } from './preview-url.ts';

/** How many polls an unlabelled address waits for a `Local:` one. A full-stack script may
 *  print its API's address, or listen on the assigned port, before its site's. */
const LABEL_WAIT_POLLS = 3;

/**
 * Where a starting server's site probably is, from best evidence to worst:
 * the owner's `url`, an address printed on a `Local:` line, the first other
 * loopback address printed, then the port Observatory assigned. The last two
 * wait a few polls for something better. It only names a candidate; whether
 * anything answers there is for the caller to find out, and it asks again as
 * the server prints more.
 */
export class SiteAddress {
  private readonly ownerUrl: string | null;
  private readonly assigned: string | null;
  private labelled: string | null = null;
  private printed: { readonly url: string; readonly sincePoll: number } | null = null;
  private polls = 0;

  /** `ownerUrl` is the owner's address; `assigned` is where a server told to use the assigned port listens. */
  constructor(ownerUrl: string | null, assigned: string | null) {
    this.ownerUrl = ownerUrl;
    this.assigned = assigned;
  }

  /** Reads one line of the server's output for an address. */
  hear(line: string): void {
    const url = localUrlIn(line);
    if (!url) return;
    if (isLocalLine(line)) this.labelled ??= url;
    else this.printed ??= { url, sincePoll: this.polls };
  }

  /** One poll has gone by. */
  pass(): void {
    this.polls += 1;
  }

  /** The address to try now, or null when nothing is worth trying yet. */
  candidate(): string | null {
    if (this.ownerUrl) return this.ownerUrl;
    if (this.labelled) return this.labelled;
    if (this.printed) {
      return this.polls - this.printed.sincePoll >= LABEL_WAIT_POLLS ? this.printed.url : null;
    }
    return this.polls >= LABEL_WAIT_POLLS ? this.assigned : null;
  }
}
