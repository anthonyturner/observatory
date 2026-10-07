import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AssistantRouter } from '../assistant/assistant-router.ts';
import type { RouteRequest } from '../assistant/route-contract.ts';
import type { EditRequest, EditTarget } from '../edits/edit-request.ts';
import type { PullEditor } from '../edits/pull-editor.ts';
import { createApiHandler } from '../http/api-handler.ts';
import type { QueueReport } from '../queue/queue-report.ts';
import { EMPTY_TRIAGE, type TriageState } from '../triage/triage.ts';
import type { TriageStore } from '../triage/triage-store.ts';
import type { ApiReads } from './api-reads.ts';
import { ownerRoutes, withAssistant } from './api-routes.ts';

const queue: QueueReport = {
  generatedAt: '2026-09-26T00:00:00Z',
  repo: 'me/app',
  items: [
    {
      number: 7,
      title: 'Add a thing',
      url: 'https://github.com/me/app/pull/7',
      isDraft: false,
      bucket: 'unreviewed',
      closes: [],
      failingChecks: 0,
      flakyChecks: [],
      additions: 1,
      deletions: 0,
      updatedAt: '2026-09-25T00:00:00Z',
      idleDays: 1,
      ageDays: 1,
      branch: 'feat/x',
      headSha: 'a'.repeat(40),
      base: 'main',
      mergeable: 'MERGEABLE',
      changedFiles: 1,
    },
  ],
};

const PULL_STATES: Record<number, string> = { 1: 'OPEN', 2: 'MERGED', 3: 'CLOSED' };

const forgotten: string[] = [];
const reads = {
  queue: async () => queue,
  projects: async () => ({ generatedAt: 'x', projects: [] }),
  issues: async (repo: string) => ({ repo, issues: [] }),
  forgetProjects: () => forgotten.push('projects'),
  forgetQueue: (repo: string) => forgotten.push(`queue ${repo}`),
  forgetIssues: (repo: string) => forgotten.push(`issues ${repo}`),
  pull: async (repo: string, number: number) => ({ repo, number }),
  commit: async (repo: string, sha: string) => ({ repo, sha }),
  sinceLook: async () => ({ newCommits: 2 }),
  sinceLookDiff: async (repo: string, base: string, head: string) => ({ repo, base, head }),
  pullState: async (_repo: string, number: number) => ({
    state: PULL_STATES[number],
    title: `Change ${number}`,
  }),
  issue: async (repo: string, number: number) => ({ repo, issue: number }),
  forgetIssue: (repo: string, number: number) => forgotten.push(`issue ${repo}#${number}`),
  forgetPull: (repo: string, number: number) => forgotten.push(`${repo}#${number}`),
  labels: async () => [{ name: 'bug', color: 'd73a4a' }],
  releases: async (repo: string) => ({ repo, source: 'none', releases: [] }),
  actions: async (repo: string) => ({ repo, runs: [] }),
  forgetActions: (repo: string) => forgotten.push(`actions ${repo}`),
  runJobs: async (repo: string, runId: number) => ({ repo, runId, jobs: [] }),
  ciHealth: async (repo: string) => ({ repo, state: 'passing' }),
  logs: async (repo: string) => ({ configured: false, reason: 'not-set', repo }),
  agentUsage: async () => ({
    generatedAt: 'x',
    days: 30,
    from: '2026-09-01',
    runs: [],
    agents: [],
    projects: [],
  }),
} as unknown as ApiReads;

/** An editor that remembers what it was asked, and changes nothing. */
function recordingEditor(): PullEditor & { asked: (EditRequest | EditTarget)[] } {
  const asked: (EditRequest | EditTarget)[] = [];
  return {
    asked,
    apply: async (request) => {
      asked.push(request);
      return { pr: request.number, status: 'applied' } as never;
    },
    read: async (target) => {
      asked.push(target);
      return null;
    },
    clear: async (target) => void asked.push(target),
  };
}

function memoryTriage(): TriageStore {
  let state: TriageState = EMPTY_TRIAGE;
  return {
    read: async () => state,
    write: async (_repo, next) => {
      state = next;
    },
  };
}

describe('ownerRoutes', () => {
  const editor = recordingEditor();
  const handle = createApiHandler(ownerRoutes(reads, memoryTriage(), editor));
  const get = async (path: string) => (await handle(new Request(`http://x${path}`))).json();
  const post = (path: string, body: unknown) =>
    handle(
      new Request(`http://x${path}`, {
        method: 'POST',
        headers: { 'x-observatory': '1', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

  it('reads a pull request by repository and number', async () => {
    assert.deepEqual(await get('/api/pull?repo=me/app&number=7'), { repo: 'me/app', number: 7 });
  });

  it('reads a repository’s releases', async () => {
    assert.deepEqual(await get('/api/releases?repo=me/app'), {
      repo: 'me/app',
      source: 'none',
      releases: [],
    });
  });

  it('reads a repository’s runs, afresh when asked, a run’s jobs and its CI health', async () => {
    assert.deepEqual(await get('/api/actions?repo=me/app'), { repo: 'me/app', runs: [] });
    forgotten.length = 0;
    await get('/api/actions?repo=me/app&fresh=1');
    assert.deepEqual(forgotten, ['actions me/app']);
    assert.deepEqual(await get('/api/actions/run?repo=me/app&run=18234567890'), {
      repo: 'me/app',
      runId: 18234567890,
      jobs: [],
    });
    assert.deepEqual(await get('/api/ci-health?repo=me/app'), { repo: 'me/app', state: 'passing' });
  });

  it('reads one issue by repository and number, and refuses a bad number', async () => {
    assert.deepEqual(await get('/api/issue?repo=me/app&number=12'), { repo: 'me/app', issue: 12 });
    forgotten.length = 0;
    await get('/api/issue?repo=me/app&number=12&fresh=1');
    assert.deepEqual(forgotten, ['issue me/app#12']);
    assert.deepEqual(await get('/api/issue?repo=me/app&number=x'), {
      error: 'number must be an issue number',
    });
  });

  it('reads whether a pull request is open, merged or closed, and refuses a bad number', async () => {
    const states = await Promise.all(
      [1, 2, 3].map((number) => get(`/api/pull-state?repo=me/app&number=${number}`)),
    );

    assert.deepEqual(states, [
      { state: 'OPEN', title: 'Change 1' },
      { state: 'MERGED', title: 'Change 2' },
      { state: 'CLOSED', title: 'Change 3' },
    ]);
    const bad = await handle(new Request('http://x/api/pull-state?repo=me/app&number=x'));
    assert.equal(bad.status, 400);
  });

  it('reads one commit’s diff by repository and hash, and refuses a hash that is not hex', async () => {
    assert.deepEqual(await get('/api/commit?repo=me/app&sha=5645CDA'), {
      repo: 'me/app',
      sha: '5645cda',
    });
    for (const sha of ['', 'xyz1234', '--output=x', '5645cda/../x']) {
      const bad = await handle(new Request(`http://x/api/commit?repo=me/app&sha=${sha}`));
      assert.equal(bad.status, 400, sha);
    }
  });

  it('reads what changed between two heads, and refuses a head that is not hex', async () => {
    assert.deepEqual(await get('/api/since-look?repo=me/app&base=AAAAAAA&head=bbbbbbb'), {
      repo: 'me/app',
      base: 'aaaaaaa',
      head: 'bbbbbbb',
    });
    for (const heads of ['base=aaaaaaa', 'head=bbbbbbb', 'base=--x&head=bbbbbbb']) {
      const bad = await handle(new Request(`http://x/api/since-look?repo=me/app&${heads}`));
      assert.equal(bad.status, 400, heads);
    }
  });

  it('counts the new commits on a pull request once its head moves past the one looked at', async () => {
    const looks = createApiHandler(ownerRoutes(reads, memoryTriage(), editor));
    const lookAt = (sha: string) =>
      looks(
        new Request('http://x/api/triage', {
          method: 'POST',
          headers: { 'x-observatory': '1', 'content-type': 'application/json' },
          body: JSON.stringify({ repo: 'me/app', number: 7, action: 'look', sha }),
        }),
      );
    const queued = async () =>
      (
        (await (await looks(new Request('http://x/api/queue?repo=me/app'))).json()) as {
          items: { lookedSha: string | null; sinceLook: unknown }[];
        }
      ).items[0];

    assert.deepEqual(await queued(), { ...(await queued()), lookedSha: null, sinceLook: null });
    await lookAt('c'.repeat(40));
    assert.deepEqual((await queued()).sinceLook, { newCommits: 2 });
    await lookAt('a'.repeat(40));
    assert.equal((await queued()).sinceLook, null);
  });

  it('reads a pull request afresh when asked to', async () => {
    forgotten.length = 0;
    await get('/api/pull?repo=me/app&number=7');
    await get('/api/pull?repo=me/app&number=7&fresh=1');
    assert.deepEqual(forgotten, ['me/app#7']);
  });

  it('reads the projects, a queue and its issues afresh only when Refresh asks', async () => {
    forgotten.length = 0;
    await get('/api/projects');
    await get('/api/queue?repo=me/app');
    await get('/api/issues?repo=me/app');
    assert.deepEqual(forgotten, []);

    await get('/api/projects?fresh=1');
    await get('/api/queue?repo=me/app&fresh=1');
    await get('/api/issues?repo=me/app&fresh=1');
    assert.deepEqual(forgotten, ['projects', 'queue me/app', 'issues me/app']);
  });

  it('lists a repository’s labels', async () => {
    assert.deepEqual(await get('/api/labels?repo=me/app'), [{ name: 'bug', color: 'd73a4a' }]);
  });

  it('applies an edit, reads its record, and clears it', async () => {
    editor.asked.length = 0;
    const edit = { repo: 'me/app', number: 7, changes: { title: 'T' } };

    assert.deepEqual(await (await post('/api/edit', edit)).json(), { pr: 7, status: 'applied' });
    assert.equal(await get('/api/edit?repo=me/app&number=7'), null);
    assert.equal((await post('/api/edit/clear', { repo: 'me/app', number: 7 })).status, 200);
    assert.deepEqual(editor.asked, [
      edit,
      { repo: 'me/app', number: 7 },
      { repo: 'me/app', number: 7 },
    ]);
  });

  it('refuses an edit without the header, or not in shape', async () => {
    const bare = await handle(
      new Request('http://x/api/edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    assert.equal(bare.status, 403);
    assert.equal((await post('/api/edit', { repo: 'me/app', number: 7, changes: {} })).status, 400);
  });

  it('records triage and shows it in the next queue read', async () => {
    const response = await handle(
      new Request('http://x/api/triage', {
        method: 'POST',
        headers: { 'x-observatory': '1', 'content-type': 'application/json' },
        body: JSON.stringify({ repo: 'me/app', number: 7, action: 'seen' }),
      }),
    );

    assert.equal(response.status, 200);
    const read = (await get('/api/queue?repo=me/app')) as { items: { isSeen: boolean }[] };
    assert.equal(read.items[0].isSeen, true);
  });

  it('reads the agent runs of the month', async () => {
    assert.equal(((await get('/api/agent-usage')) as { days: number }).days, 30);
  });

  it('reads a repository’s Log Sky', async () => {
    assert.deepEqual(await get('/api/logs?repo=me/app'), {
      configured: false,
      reason: 'not-set',
      repo: 'me/app',
    });
  });

  it('refuses a malformed repository name', async () => {
    assert.equal((await handle(new Request('http://x/api/queue?repo=nope'))).status, 400);
  });
});

describe('withAssistant', () => {
  const routed: RouteRequest[] = [];
  const assistant: AssistantRouter = {
    status: async () => ({ jev: 'off', where: 'local', skills: [] }),
    route: async (request) => {
      routed.push(request);
      return { via: 'keyword', tier: 1, action: 'help', op: 'help', jev: 'off' };
    },
  };
  const handle = createApiHandler(
    withAssistant(ownerRoutes(reads, memoryTriage(), recordingEditor()), assistant),
  );
  const route = (body: unknown) =>
    handle(
      new Request('http://x/api/route', {
        method: 'POST',
        headers: { 'x-observatory': '1', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

  it('answers the status, routes a request in shape, and keeps the owner’s routes', async () => {
    const status = await (await handle(new Request('http://x/api/route'))).json();
    const reply = (await (await route({ text: ' help ' })).json()) as { op: string };

    assert.deepEqual(status, { jev: 'off', where: 'local', skills: [] });
    assert.equal(reply.op, 'help');
    assert.deepEqual(routed, [{ skill: null, pick: null, text: 'help', history: [] }]);
    assert.equal((await handle(new Request('http://x/api/labels?repo=me/app'))).status, 200);
  });

  it('refuses a request that is not one', async () => {
    const response = await route({ text: '' });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'bad request: nothing to route' });
  });
});
