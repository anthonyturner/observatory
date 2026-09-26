import { type ApiReads, cachedReads } from '../app/api-reads.ts';
import { ownerRoutes } from '../app/api-routes.ts';
import { uncheckedCollisions } from '../collisions/collisions-report.ts';
import type { GitHub } from '../github/github.ts';
import type { RepoRef } from '../github/github-reader.ts';
import { storeEditStore } from '../edits/edit-store.ts';
import { pullEditor } from '../edits/pull-editor.ts';
import { githubApiReader } from '../github/github-api-reader.ts';
import { storeHistoryStore } from '../history/history-store.ts';
import { type ApiHandler, createApiHandler, json } from '../http/api-handler.ts';
import { withoutCode } from '../queue/pull-detail.ts';
import type { Store } from '../store/store.ts';
import { upstashStore } from '../store/upstash-store.ts';
import { storeTriageStore } from '../triage/triage-store.ts';
import { machineRoutes } from './machine-routes.ts';
import {
  LOGS_NOT_PUSHED,
  USAGE_KEY,
  collisionsFrom,
  collisionsKey,
  logsFrom,
  logsKey,
  usageFrom,
  withPushedConflicts,
} from './pushed-data.ts';
import { cached } from '../util/cached.ts';
import { gatedHandler } from './gated-handler.ts';
import { githubSignIn } from './github-sign-in.ts';
import { type Env, type HostedConfig, hostedConfigFrom } from './hosted-config.ts';
import { type VisibleRepos, visitorRoutes } from './visitor-routes.ts';

/** Which repositories are private changes rarely; asked again at most this often. */
const REPOS_TTL_MS = 5 * 60_000;
const HTTP_SERVER_ERROR = 500;

/** What the hosted site reads and keeps; tests give their own. */
export interface HostedDependencies {
  readonly store: Store;
  readonly github: GitHub;
}

const defaultDependencies = (config: HostedConfig): HostedDependencies => ({
  store: upstashStore(config.redis),
  github: githubApiReader({ token: config.githubToken }),
});

/** The owner's repositories, read again at most every few minutes. */
const ownedRepos = (github: GitHub, config: HostedConfig) =>
  cached(() => github.ownedRepos(config.owner), REPOS_TTL_MS);

/** The owner's repositories a visitor may see: public ones, or all with `PUBLIC_PREVIEW=all`. */
function visibleRepos(repos: () => Promise<RepoRef[]>, config: HostedConfig): VisibleRepos {
  return async () => {
    const shown = (await repos()).filter((repo) => config.preview === 'all' || !repo.isPrivate);
    return new Set(shown.map((repo) => repo.nameWithOwner.toLowerCase()));
  };
}

/**
 * `live` with what a push from the owner's machine brought: merge checks laid
 * over the shared-file pairs, and the Log Sky. Read from the store on every
 * request, so a push shows at once; only what comes from GitHub stays cached.
 */
function pushedReads(live: ApiReads, store: Store): ApiReads {
  return {
    ...live,
    collisions: async (repo) =>
      withPushedConflicts(
        await live.collisions(repo),
        collisionsFrom(await store.get(collisionsKey(repo))),
      ),
    logs: async (repo) => logsFrom(await store.get(logsKey(repo))) ?? LOGS_NOT_PUSHED,
  };
}

/** What a visitor reads: a private repository's pull requests without their code.
 *  One whose privacy is not known counts as private. */
function visitorReads(reads: ApiReads, repos: () => Promise<RepoRef[]>): ApiReads {
  return {
    ...reads,
    pull: async (repo, number) => {
      const detail = await reads.pull(repo, number);
      const isPublic = (await repos()).some(
        (each) => !each.isPrivate && each.nameWithOwner.toLowerCase() === repo.toLowerCase(),
      );
      return isPublic ? detail : withoutCode(detail);
    },
  };
}

/** The API as it runs on Vercel, from the environment. */
function hostedHandler(config: HostedConfig, dependencies: HostedDependencies): ApiHandler {
  const { store } = dependencies;
  // The hosted site charts the configured account, not whoever the token belongs to.
  const github: GitHub = { ...dependencies.github, viewer: async () => config.owner };
  const history = storeHistoryStore(store);
  const triage = storeTriageStore(store);
  const repos = ownedRepos(github, config);
  const reads = pushedReads(
    cachedReads({
      github,
      history,
      // No clone here: the pairs are worked out from the files pull requests share.
      collisions: (repo) => uncheckedCollisions(github, repo),
      usage: async () => usageFrom(await store.get(USAGE_KEY)),
      logs: async () => LOGS_NOT_PUSHED,
    }),
    store,
  );
  const editor = pullEditor({
    writer: github,
    labels: (repo) => reads.labels(repo),
    store: storeEditStore(store),
    changed: ({ repo, number }) => reads.forgetPull(repo, number),
    now: Date.now,
  });
  const owner = ownerRoutes(reads, triage, editor);
  const machines = machineRoutes({
    reads,
    store,
    triage,
    history,
    repos: async () => (await repos()).map((repo) => repo.nameWithOwner),
    cronSecret: config.machineSecrets.cron,
    pushToken: config.machineSecrets.push,
  });
  const signIn = githubSignIn({
    clientId: config.oauth.clientId,
    clientSecret: config.oauth.clientSecret,
    allowed: config.allowedLogins,
    secret: config.sessionSecret,
    siteUrl: config.siteUrl,
    visitors: config.preview !== 'off',
  });
  const policy = { privateRepos: config.preview === 'all', logs: config.previewLogs };
  return gatedHandler({
    open: { ...signIn.routes, ...machines },
    access: signIn.access,
    signIn: signIn.signIn,
    owner: createApiHandler(owner),
    visitor:
      config.preview === 'off'
        ? null
        : createApiHandler(
            visitorRoutes(owner, visitorReads(reads, repos), visibleRepos(repos, config), policy),
          ),
  });
}

/**
 * The hosted API from its environment. A site missing a required variable
 * answers every request saying which, rather than failing deep in one.
 */
export function hostedApi(
  env: Env,
  dependencies?: (config: HostedConfig) => HostedDependencies,
): ApiHandler {
  const result = hostedConfigFrom(env);
  if (!result.ok) {
    const error = `the site is not configured: ${result.problem}`;
    return async () => json(HTTP_SERVER_ERROR, { error });
  }
  return hostedHandler(result.config, (dependencies ?? defaultDependencies)(result.config));
}
