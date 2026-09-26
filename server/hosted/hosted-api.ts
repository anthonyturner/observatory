import { cachedReads } from '../app/api-reads.ts';
import { ownerRoutes } from '../app/api-routes.ts';
import { uncheckedCollisions } from '../collisions/collisions-report.ts';
import type { GitHub } from '../github/github.ts';
import { githubApiReader } from '../github/github-api-reader.ts';
import { storeHistoryStore } from '../history/history-store.ts';
import { type ApiHandler, createApiHandler, json } from '../http/api-handler.ts';
import type { Store } from '../store/store.ts';
import { upstashStore } from '../store/upstash-store.ts';
import { storeTriageStore } from '../triage/triage-store.ts';
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

/** The owner's repositories a visitor may see: public ones, or all with `PUBLIC_PREVIEW=all`. */
function visibleRepos(github: GitHub, config: HostedConfig): VisibleRepos {
  return cached(async () => {
    const repos = await github.ownedRepos(config.owner);
    const shown = repos.filter((repo) => config.preview === 'all' || !repo.isPrivate);
    return new Set(shown.map((repo) => repo.nameWithOwner.toLowerCase()));
  }, REPOS_TTL_MS);
}

/** The API as it runs on Vercel, from the environment. */
function hostedHandler(config: HostedConfig, dependencies: HostedDependencies): ApiHandler {
  const { store } = dependencies;
  // The hosted site charts the configured account, not whoever the token belongs to.
  const github: GitHub = { ...dependencies.github, viewer: async () => config.owner };
  const reads = cachedReads({
    github,
    history: storeHistoryStore(store),
    collisions: (repo) => uncheckedCollisions(github, repo),
    usage: async () => null,
  });
  const owner = ownerRoutes(reads, storeTriageStore(store));
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
    open: signIn.routes,
    access: signIn.access,
    signIn: signIn.signIn,
    owner: createApiHandler(owner),
    visitor:
      config.preview === 'off'
        ? null
        : createApiHandler(visitorRoutes(owner, reads, visibleRepos(github, config), policy)),
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
