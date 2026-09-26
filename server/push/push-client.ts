import type { CollisionsReport } from '../collisions/collisions-report.ts';
import type { Frame } from '../history/frames.ts';
import type { LogSnapshot } from '../logs/log-types.ts';
import { type TriageState } from '../triage/triage.ts';
import { triageStateFrom } from '../triage/triage-store.ts';
import type { UsageReport } from '../usage/usage-types.ts';
import type { PushTarget } from './push-target.ts';

/** What one push sends; the site takes whichever parts are there. */
export interface PushBody {
  readonly repo?: string;
  readonly triage?: TriageState;
  readonly frames?: readonly Frame[];
  readonly collisions?: CollisionsReport;
  readonly logs?: LogSnapshot;
  readonly usage?: UsageReport;
}

/** The hosted site's push routes. */
export interface PushClient {
  /** The triage the hosted page holds for `repo`. */
  hostedTriage(repo: string): Promise<TriageState>;
  /** Sends a push; answers what the site wrote. */
  send(body: PushBody): Promise<readonly string[]>;
}

const MAX_ERROR_LENGTH = 300;

/** The push routes over HTTP, with the push token. */
export function pushClient(target: PushTarget, send: typeof fetch = fetch): PushClient {
  async function call(method: 'GET' | 'POST', path: string, body?: PushBody): Promise<unknown> {
    const response = await send(`${target.site}${path}`, {
      method,
      headers: { authorization: `Bearer ${target.token}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const value: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = (value as { error?: unknown } | null)?.error ?? '';
      throw new Error(
        `${method} ${path}: ${response.status} ${String(reason)}`.slice(0, MAX_ERROR_LENGTH),
      );
    }
    return value;
  }
  return {
    async hostedTriage(repo) {
      const answer = await call('GET', `/api/push?repo=${encodeURIComponent(repo)}`);
      return triageStateFrom((answer as { triage?: unknown } | null)?.triage);
    },
    async send(body) {
      const answer = await call('POST', '/api/push', body);
      const wrote = (answer as { wrote?: unknown } | null)?.wrote;
      return Array.isArray(wrote) ? wrote.map(String) : [];
    },
  };
}
