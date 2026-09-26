import type { CollisionsReport } from '../collisions/collisions-report.ts';
import type { HistoryStore } from '../history/history-store.ts';
import type { LogSnapshot, LogsUnconfigured } from '../logs/log-types.ts';
import { mergeTriage } from '../triage/triage-merge.ts';
import type { TriageStore } from '../triage/triage-store.ts';
import type { UsageReport } from '../usage/usage-types.ts';
import type { PushBody, PushClient } from './push-client.ts';

/** What a push reads on this machine, and where it sends it. */
export interface PushSources {
  readonly client: PushClient;
  /** The repositories to push, as `owner/name`: the ones Home charts. */
  readonly repos: () => Promise<readonly string[]>;
  readonly triage: TriageStore;
  readonly history: HistoryStore;
  /** Real merge checks between branches, which need a clone here. */
  readonly collisions: (repo: string) => Promise<CollisionsReport>;
  /** The app's folded logs, where a folder is set for the repository here. */
  readonly logs: (repo: string) => Promise<LogSnapshot | LogsUnconfigured>;
  readonly usage: () => Promise<UsageReport>;
}

/** What happened to one repository, or to the account's usage. */
export type PushResult =
  | { readonly target: string; readonly wrote: readonly string[]; readonly broughtHome: boolean }
  | { readonly target: string; readonly error: string };

const MAX_ERROR_LENGTH = 300;
const USAGE_TARGET = 'usage';

const errorOf = (target: string, error: unknown): PushResult => ({
  target,
  error: (error instanceof Error ? error.message : String(error)).slice(0, MAX_ERROR_LENGTH),
});

/**
 * One repository: brings the hosted page's snoozes and dismissals home, then
 * sends up what only this machine knows. Triage is merged both ways by
 * whichever side changed each pull request last, so both end up the same.
 */
async function pushRepo(sources: PushSources, repo: string): Promise<PushResult> {
  const ours = await sources.triage.read(repo);
  const merged = mergeTriage(ours, await sources.client.hostedTriage(repo));
  const broughtHome = JSON.stringify(merged) !== JSON.stringify(ours);
  if (broughtHome) await sources.triage.write(repo, merged);
  const frames = await sources.history.read(repo);
  const collisions = await sources.collisions(repo);
  const logs = await sources.logs(repo);
  const body: PushBody = {
    repo,
    triage: merged,
    ...(frames.length ? { frames } : {}),
    // The site works out which files pull requests share by itself; only a
    // real merge check is worth sending.
    ...(collisions.check === 'checked' ? { collisions } : {}),
    ...('configured' in logs ? {} : { logs }),
  };
  return { target: repo, wrote: await sources.client.send(body), broughtHome };
}

/** Pushes every repository, or only `only`, and the account's usage when pushing all. */
export async function pushAll(sources: PushSources, only: string | null): Promise<PushResult[]> {
  const repos = only ? [only] : await sources.repos();
  const results: PushResult[] = [];
  for (const repo of repos) {
    results.push(await pushRepo(sources, repo).catch((error: unknown) => errorOf(repo, error)));
  }
  if (only) return results;
  try {
    const wrote = await sources.client.send({ usage: await sources.usage() });
    results.push({ target: USAGE_TARGET, wrote, broughtHome: false });
  } catch (error) {
    results.push(errorOf(USAGE_TARGET, error));
  }
  return results;
}
