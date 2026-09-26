import { timingSafeEqual } from 'node:crypto';
import type { ApiReads } from '../app/api-reads.ts';
import type { Frame } from '../history/frames.ts';
import { type HistoryMerger, framesFrom } from '../history/history-store.ts';
import { BadRequest, NotFound, answer, json, readJson } from '../http/api-handler.ts';
import { repoNameFrom } from '../queue/repo-name.ts';
import type { Store } from '../store/store.ts';
import type { TriageStore } from '../triage/triage-store.ts';
import { triageStateFrom } from '../triage/triage-store.ts';
import { mergeTriage } from '../triage/triage-merge.ts';
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

  async function takePush(body: PushBody): Promise<{ readonly wrote: readonly string[] }> {
    const wrote: string[] = [];
    if (body.usage !== undefined) {
      const usage = usageFrom(body.usage);
      if (!usage) throw new BadRequest('usage is not a usage report');
      await store.set(USAGE_KEY, usage);
      wrote.push('usage');
    }
    if (body.repo === undefined) return { wrote };
    const repo = await chartedRepo(body.repo);
    if (body.triage !== undefined) {
      await triage.write(repo, mergeTriage(await triage.read(repo), triageStateFrom(body.triage)));
      wrote.push('triage');
    }
    if (body.frames !== undefined) {
      const frames: Frame[] = framesFrom({ frames: body.frames });
      await history.merge(repo, frames);
      wrote.push(`${frames.length} frames`);
    }
    if (body.collisions !== undefined) {
      const collisions = collisionsFrom(body.collisions);
      if (!collisions) throw new BadRequest('collisions is not a collisions report');
      await store.set(collisionsKey(repo), collisions);
      wrote.push('collisions');
    }
    if (body.logs !== undefined) {
      const logs = logsFrom(body.logs);
      if (!logs) throw new BadRequest('logs is not a Log Sky snapshot');
      await store.set(logsKey(repo), logs);
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
      const projects = await reads.projects();
      return json(200, {
        at: new Date().toISOString(),
        projects: projects.projects.length,
        results,
      });
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
