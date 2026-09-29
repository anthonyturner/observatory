import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GitHub } from '../github/github.ts';
import type { QueuePull } from '../github/queue-reader.ts';
import type { Store } from '../store/store.ts';
import { hostedApi } from './hosted-api.ts';
import { sealer } from './sealed-value.ts';

const SECRET = 'k'.repeat(32);
const SITE = 'https://observatory.example';

const ENV = {
  KV_REST_API_URL: 'https://kv.example',
  KV_REST_API_TOKEN: 'kv-token',
  GITHUB_TOKEN: 'gh-token',
  GITHUB_OWNER: 'me',
  GITHUB_CLIENT_ID: 'client',
  GITHUB_CLIENT_SECRET: 'client-secret',
  ALLOWED_LOGINS: 'me',
  SESSION_SECRET: SECRET,
  CRON_SECRET: 'c'.repeat(32),
  PUSH_TOKEN: 'p'.repeat(32),
};

const pull = (number: number): QueuePull => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/x/pull/${number}`,
  mergeable: 'MERGEABLE',
  statusCheckRollup: [],
  closingIssuesReferences: [{ number: 1 }],
  updatedAt: '2026-09-25T00:00:00Z',
  isDraft: false,
  additions: 1,
  deletions: 1,
  createdAt: '2026-09-24T00:00:00Z',
  headRefName: `change-${number}`,
  baseRefName: 'main',
  changedFiles: 1,
});

/** Two repositories, one private; each with one open pull request. */
const github = {
  viewer: async () => 'whoever-owns-the-token',
  ownedRepos: async () => [
    { name: 'app', nameWithOwner: 'me/app', isPrivate: false },
    { name: 'secret', nameWithOwner: 'me/secret', isPrivate: true },
  ],
  openPulls: async () => [pull(7)],
  queuePulls: async () => [pull(7)],
  mergeableOf: async () => 'MERGEABLE',
  openIssueNumbers: async () => [1],
  pullState: async () => 'OPEN',
  pullFiles: async () => [],
  pullDetail: async (repo: string, number: number) => ({
    ...pull(number),
    url: `https://github.com/${repo}/pull/${number}`,
    body: '',
    author: null,
    baseRefName: 'main',
    headRefOid: 'f'.repeat(40),
    labels: [],
    assignees: [],
    reviewDecision: '',
    reviewRequests: [],
    latestReviews: [],
    files: [],
    commits: [],
  }),
  pullDiff: async () => 'diff --git a/x b/x\n+secret code',
} as unknown as GitHub;

function memoryStore(): Store & { readonly data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => void data.set(key, structuredClone(value)),
  };
}

function site(env: Record<string, string> = ENV) {
  const store = memoryStore();
  return { store, handle: hostedApi(env, () => ({ store, github })) };
}

const ownerCookie = `obs_session=${sealer(SECRET).seal({ login: 'me', exp: Date.now() + 60_000 })}`;

const get = (handle: ReturnType<typeof site>['handle'], path: string, cookie?: string) =>
  handle(new Request(`${SITE}${path}`, { headers: cookie ? { cookie } : {} }));

const triage = (handle: ReturnType<typeof site>['handle'], cookie?: string) =>
  handle(
    new Request(`${SITE}/api/triage`, {
      method: 'POST',
      headers: {
        'x-observatory': '1',
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ repo: 'me/app', number: 7, action: 'dismiss' }),
    }),
  );

describe('hostedApi', () => {
  it('says which variables are missing, on every request', async () => {
    const { handle } = site({ ...ENV, GITHUB_TOKEN: '', SESSION_SECRET: '' });

    const response = await get(handle, '/api/projects');

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: 'the site is not configured: missing GITHUB_TOKEN, SESSION_SECRET',
    });
  });

  it('says plainly when the session secret is too short to be safe', async () => {
    const { handle } = site({ ...ENV, SESSION_SECRET: 'short' });

    assert.deepEqual(await (await get(handle, '/api/session')).json(), {
      error: 'the site is not configured: SESSION_SECRET must be at least 32 characters',
    });
  });

  it('asks anyone without a session to sign in, when there is no preview', async () => {
    const { handle } = site();

    const response = await get(handle, '/api/projects');

    assert.equal(response.status, 401);
    assert.deepEqual(await (await get(handle, '/api/session')).json(), {
      access: 'signed-out',
      signIn: '/api/auth/login',
    });
    assert.equal((await triage(handle)).status, 401);
  });

  it('gives the owner every route, writes included, charting GITHUB_OWNER', async () => {
    const { handle, store } = site();

    const session = (await (await get(handle, '/api/session', ownerCookie)).json()) as {
      access: string;
    };
    const projects = (await (await get(handle, '/api/projects', ownerCookie)).json()) as {
      projects: { repo: string }[];
    };
    const written = await triage(handle, ownerCookie);

    assert.equal(session.access, 'owner');
    assert.deepEqual(
      projects.projects.map((project) => project.repo),
      ['me/app', 'me/secret'],
    );
    assert.equal(written.status, 200);
    assert.ok(store.data.has('triage/me__app'));
    assert.equal((await get(handle, '/api/usage', ownerCookie)).status, 200);
  });

  it('has no runs routes, even for the owner: tier 3 runs on the local server only', async () => {
    const { handle } = site();
    const asOwner = (method: string) =>
      handle(
        new Request(`${SITE}/api/runs?id=x`, {
          method,
          headers: {
            cookie: ownerCookie,
            'x-observatory': '1',
            'content-type': 'application/json',
          },
          ...(method === 'POST' ? { body: '{}' } : {}),
        }),
      );

    for (const method of ['GET', 'POST', 'DELETE']) {
      assert.equal((await asOwner(method)).status, 404, method);
    }
  });

  it('shows a visitor public repositories only, read-only, with no triage', async () => {
    const { handle, store } = site({ ...ENV, PUBLIC_PREVIEW: 'on' });
    await triage(handle, ownerCookie);

    const session = (await (await get(handle, '/api/session')).json()) as { access: string };
    const projects = (await (await get(handle, '/api/projects')).json()) as {
      projects: { repo: string }[];
      directives: { project: string }[];
    };
    const queue = (await (await get(handle, '/api/queue?repo=me/app')).json()) as {
      items: { hidden: unknown; isSeen: boolean }[];
    };
    const before = JSON.stringify([...store.data]);

    assert.equal(session.access, 'visitor');
    assert.deepEqual(
      projects.projects.map((project) => project.repo),
      ['me/app'],
    );
    assert.ok(projects.directives.every((directive) => directive.project === 'app'));
    assert.deepEqual(queue.items[0], { ...queue.items[0], hidden: null, isSeen: false });
    assert.equal((await get(handle, '/api/queue?repo=me/secret')).status, 404);
    assert.equal((await get(handle, '/api/pull?repo=ME/Secret&number=7')).status, 404);
    assert.equal((await triage(handle)).status, 403);
    assert.equal(await (await get(handle, '/api/usage')).json(), null);
    assert.equal(JSON.stringify([...store.data]), before);
  });

  it('has no assistant and no voice, for anyone, even with their keys set', async () => {
    const { handle } = site({
      ...ENV,
      PUBLIC_PREVIEW: 'all',
      OPENROUTER_API_KEY: 'sk-or-test',
      ELEVENLABS_OBSERVATORY_KEY: 'eleven-test',
    });
    const post = (path: string, body: object, cookie?: string) =>
      handle(
        new Request(`${SITE}${path}`, {
          method: 'POST',
          headers: {
            'x-observatory': '1',
            'content-type': 'application/json',
            ...(cookie ? { cookie } : {}),
          },
          body: JSON.stringify(body),
        }),
      );

    for (const cookie of [ownerCookie, undefined]) {
      assert.equal((await get(handle, '/api/route', cookie)).status, 404);
      assert.equal((await post('/api/route', { text: 'read my code' }, cookie)).status, 404);
      assert.equal((await get(handle, '/api/voice', cookie)).status, 404);
      assert.equal(
        (await post('/api/voice/speak', { text: 'Hello.', voice: 'abc123' }, cookie)).status,
        404,
      );
    }
  });

  it('shows a visitor private repositories too with PUBLIC_PREVIEW=all, still read-only', async () => {
    const { handle } = site({ ...ENV, PUBLIC_PREVIEW: 'all' });

    const projects = (await (await get(handle, '/api/projects')).json()) as {
      projects: { repo: string }[];
    };

    assert.equal(projects.projects.length, 2);
    assert.equal((await get(handle, '/api/queue?repo=me/secret')).status, 200);
    assert.equal((await triage(handle)).status, 403);
  });

  it('withholds a private repository’s code from a visitor, and only from a visitor', async () => {
    const { handle } = site({ ...ENV, PUBLIC_PREVIEW: 'all' });
    const read = async (repo: string, cookie?: string) =>
      (await (await get(handle, `/api/pull?repo=${repo}&number=7`, cookie)).json()) as {
        diff: string;
        diffHidden: boolean;
      };

    const secret = await read('me/secret');
    assert.deepEqual([secret.diff, secret.diffHidden], ['', true]);
    assert.equal((await read('me/app')).diffHidden, false);
    assert.match((await read('me/app')).diff, /secret code/);
    assert.match((await read('me/secret', ownerCookie)).diff, /secret code/);
  });

  it('sends a run-out session to sign in even with the preview on', async () => {
    const { handle } = site({ ...ENV, PUBLIC_PREVIEW: 'on' });
    const expired = `obs_session=${sealer(SECRET).seal({ login: 'me', exp: Date.now() - 1 })}`;

    assert.equal((await get(handle, '/api/projects', expired)).status, 401);
  });

  it('answers sign-in before asking who is there', async () => {
    const { handle } = site();

    const response = await get(handle, '/api/auth/login?next=/p/me/app');

    assert.equal(response.status, 302);
    assert.match(String(response.headers.get('location')), /^https:\/\/github\.com\/login\/oauth/);
  });
});
