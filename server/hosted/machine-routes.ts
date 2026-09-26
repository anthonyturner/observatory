import { timingSafeEqual } from 'node:crypto';
import type { ApiReads } from '../app/api-reads.ts';
import type { CollisionsReport } from '../collisions/collisions-report.ts';
import type { Frame } from '../history/frames.ts';
import { type HistoryMerger, framesFrom } from '../history/history-store.ts';
import { BadRequest, NotFound, answer, json, readJson } from '../http/api-handler.ts';
import { repoNameFrom } from '../queue/repo-name.ts';
import type { LogSnapshot } from '../logs/log-types.ts';
import type { Store } from '../store/store.ts';
import type { TriageState } from '../triage/triage.ts';
import type { TriageStore } from '../triage/triage-store.ts';
import { triageStateFrom } from '../triage/triage-store.ts';
import { mergeTriage } from '../triage/triage-merge.ts';
import type { UsageReport } from '../usage/usage-types.ts';
import type { OpenRoutes } from './gated-handler.ts';
import {
  USAGE_KEY,
  collisionsFrom,
  collisionsKey,
  logsFrom,
  logsKey,
  usageFrom,
} from './pushed-data.ts';

/** What the scheduler and the push command reach, each with its own secret. */
export interface MachineSources {
  readonly reads: ApiReads;
  readonly store: Store;
  readonly triage: TriageStore;
  readonly history: HistoryMerger;
  /** Every repository the site charts, as `owner/name`. */
  readonly repos: () => Promise<readonly string[]>;
  readonly cronSecret: string;
  readonly pushToken: string;
}

const HTTP_UNAUTHORIZED = 401;
/** A push carries a repository's frames and collisions, or a month of usage: well under this. */
const MAX_PUSH_BYTES = 4 * 1024 * 1024;
const MAX_ERROR_LENGTH = 200;

/** Whether the request carries `Authorization: Bearer <secret>`, compared in constant time. */
export function hasBearer(request: Request, secret: string): boolean {
  const given = Buffer.from(
    (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''),
  );
  const wanted = Buffer.from(secret);
  return wanted.length > 0 && given.length === wanted.length && timingSafeEqual(given, wanted);
}

const unauthorised = (): Response => json(HTTP_UNAUTHORIZED, { error: 'unauthorised' });

const firstLine = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error))
    .split('\n')[0]
    .slice(0, MAX_ERROR_LENGTH);

/** What `POST /api/push` accepts; each part is optional. */
interface PushBody {
  readonly repo?: unknown;
  readonly triage?: unknown;
  readonly frames?: unknown;
  readonly collisions?: unknown;
  readonly logs?: unknown;
  readonly usage?: unknown;
}

/** A push's parts, each checked. */
interface CheckedPush {
  readonly usage?: UsageReport;
  readonly triage?: TriageState;
  readonly frames?: Frame[];
  readonly collisions?: CollisionsReport;
  readonly logs?: LogSnapshot;
}

/** `value` read by `read`, or a BadRequest saying it is not `what`; absent stays absent. */
function part<T>(value: unknown, read: (value: unknown) => T | null, what: string): T | undefined {
  if (value === undefined) return undefined;
  const checked = read(value);
  if (checked === null) throw new BadRequest(`${what} is malformed`);
  return checked;
}

/** Every part checked before anything is written, so a malformed one leaves the site as it was. */
function checkedPush(body: PushBody): CheckedPush {
  const parts: CheckedPush = {
    usage: part(body.usage, usageFrom, 'usage'),
    triage: part(body.triage, triageStateFrom, 'triage'),
    frames: part(body.frames, (frames) => framesFrom({ frames }), 'frames'),
    collisions: part(body.collisions, collisionsFrom, 'collisions'),
    logs: part(body.logs, logsFrom, 'logs'),
  };
  return Object.fromEntries(Object.entries(parts).filter((entry) => entry[1] !== undefined));
}

/**
 * The routes for machines, not people. Vercel's scheduler calls the cron with
 * `CRON_SECRET`; `npm run push` calls push with `PUSH_TOKEN`. Neither passes
 * through sign-in, so each checks its own secret first.
 */
export function machineRoutes(sources: MachineSources): OpenRoutes {
  const { reads, store, triage, history } = sources;

  /** A repository the site charts, or NotFound: a push cannot write under any other name. */
  async function chartedRepo(value: unknown): Promise<string> {
    const repo = repoNameFrom(typeof value === 'string' ? value : null);
    const charted = (await sources.repos()).find(
      (each) => each.toLowerCase() === repo.toLowerCase(),
    );
    if (!charted) throw new NotFound(`${repo} is not charted here`);
    return charted;
  }

  /** Writes each checked part, and says what it wrote. */
  async function takePush(body: PushBody): Promise<{ readonly wrote: readonly string[] }> {
    const parts = checkedPush(body);
    const repo = body.repo === undefined ? null : await chartedRepo(body.repo);
    if (!repo && Object.keys(parts).some((part) => part !== 'usage')) {
      throw new BadRequest('repo is required with triage, frames, collisions or logs');
    }
    const wrote: string[] = [];
    if (parts.usage) {
      await store.set(USAGE_KEY, parts.usage);
      wrote.push('usage');
    }
    if (!repo) return { wrote };
    if (parts.triage) {
      await triage.write(repo, mergeTriage(await triage.read(repo), parts.triage));
      wrote.push('triage');
    }
    if (parts.frames) {
      await history.merge(repo, parts.frames);
      wrote.push(`${parts.frames.length} frames`);
    }
    if (parts.collisions) {
      await store.set(collisionsKey(repo), parts.collisions);
      wrote.push('collisions');
    }
    if (parts.logs) {
      await store.set(logsKey(repo), parts.logs);
      wrote.push('logs');
    }
    return { wrote };
  }

  return {
    'GET /api/cron': async (request) => {
      if (!hasBearer(request, sources.cronSecret)) return unauthorised();
      const results = [];
      for (const repo of await sources.repos()) {
        try {
          results.push({ repo, open: (await reads.queue(repo)).items.length });
        } catch (error) {
          results.push({ repo, error: firstLine(error) });
        }
      }
      const projects = await reads.projects().then(
        (report) => report.projects.length,
        (error: unknown) => firstLine(error),
      );
      return json(200, { at: new Date().toISOString(), projects, results });
    },

    'GET /api/push': async (request, url) => {
      if (!hasBearer(request, sources.pushToken)) return unauthorised();
      return answer(async () => {
        const repo = await chartedRepo(url.searchParams.get('repo'));
        return { repo, triage: await triage.read(repo) };
      });
    },

    'POST /api/push': async (request) => {
      if (!hasBearer(request, sources.pushToken)) return unauthorised();
      return answer(async () => {
        const body = await readJson(request, MAX_PUSH_BYTES);
        if (typeof body !== 'object' || body === null)
          throw new BadRequest('body must be an object');
        return takePush(body);
      });
    },
  };
}
