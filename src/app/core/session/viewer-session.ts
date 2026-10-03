import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';

/**
 * Who is looking, as the API says. `local` is this machine, with no sign-in;
 * hosted, `owner` is signed in, `visitor` is looking at the read-only preview,
 * and `signed-out` must sign in before seeing anything.
 */
export type Access = 'local' | 'owner' | 'visitor' | 'signed-out';

/** The browser's address, behind a token so a test can stand in for it. */
export interface PageLocation {
  /** The path and query of the page, to come back to after signing in. */
  readonly here: () => string;
  readonly assign: (url: string) => void;
}

export const PAGE_LOCATION = new InjectionToken<PageLocation>('PAGE_LOCATION', {
  providedIn: 'root',
  factory: () => ({
    here: () => `${window.location.pathname}${window.location.search}`,
    assign: (url) => window.location.assign(url),
  }),
});

interface SessionAnswer {
  readonly access: Access;
  readonly signIn: string | null;
}

const SESSION_URL = '/api/session';
const ACCESSES: readonly Access[] = ['local', 'owner', 'visitor', 'signed-out'];

function parseSession(body: unknown): SessionAnswer | null {
  if (typeof body !== 'object' || body === null) return null;
  const { access, signIn } = body as Record<string, unknown>;
  if (!ACCESSES.includes(access as Access)) return null;
  return { access: access as Access, signIn: typeof signIn === 'string' ? signIn : null };
}

/**
 * Asks the API once who is looking. Until it answers, or if it cannot, the
 * page behaves as on this machine: nothing is hidden and nobody is sent away.
 */
@Injectable({ providedIn: 'root' })
export class ViewerSession {
  private readonly location = inject(PAGE_LOCATION);
  private readonly answer = signal<SessionAnswer | null>(null);

  readonly access = computed<Access>(() => this.answer()?.access ?? 'local');
  /** True only once the API has said this is the owner's machine, never on
   *  `access`'s assumption, for what must not happen anywhere else. */
  readonly isConfirmedLocal = computed(() => this.answer()?.access === 'local');
  /** Whether this viewer may change anything, such as triage. */
  readonly canWrite = computed(() => this.access() === 'local' || this.access() === 'owner');
  readonly isVisitor = computed(() => this.access() === 'visitor');
  /** Where to sign in and come back to this page, or null where there is no sign-in. */
  readonly signInUrl = computed(() => {
    const signIn = this.answer()?.signIn;
    return signIn ? `${signIn}?next=${encodeURIComponent(this.location.here())}` : null;
  });

  constructor() {
    // Answered once, then done: no subscription outlives the request.
    inject(HttpClient)
      .get<unknown>(SESSION_URL)
      .subscribe({ next: (body) => this.settle(parseSession(body)), error: () => undefined });
  }

  private settle(answer: SessionAnswer | null): void {
    this.answer.set(answer);
    const signInUrl = this.signInUrl();
    if (answer?.access === 'signed-out' && signInUrl) this.location.assign(signInUrl);
  }
}
