import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RunOffer } from '../assistant/route-contract.ts';
import { createApiHandler } from '../http/api-handler.ts';
import type { QueueItem, QueueReport } from '../queue/queue-report.ts';
import { CREW_TAG } from './crew-prompt.ts';
import type { CrewQueue, CrewRunner } from './crew-proposal.ts';
import { CREW_PATH, withCrewRoutes } from './crew-routes.ts';

const BASE = `http://localhost${CREW_PATH}`;
const WRITE = { 'x-observatory': '1', 'content-type': 'application/json' };
const TICKET = {
  token: 'token-1',
  folder: 'E:/repos/app',
  name: 'app',
  expiresAt: 2_000,
  limitMs: 1_800_000,
  command: 'claude -p',
};

const item = (number: number, overrides: Partial<QueueItem> = {}): QueueItem => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/app/pull/${number}`,
  isDraft: false,
  bucket: 'conflicted',
  closes: [],
  failingChecks: 0,
  additions: 1,
  deletions: 1,
  updatedAt: '2026-10-01T00:00:00Z',
  branch: `feat/${number}`,
  headSha: 'a'.repeat(40),
  base: 'main',
  mergeable: 'CONFLICTING',
  changedFiles: 1,
  idleDays: 1,
  ageDays: 1,
  ...overrides,
});

function setUp(items: readonly QueueItem[], offer: RunOffer = { run: TICKET }, isAvailable = true) {
  const forgotten: string[] = [];
  const offers: { prompt: string; repo: string | null }[] = [];
  const queue: CrewQueue = {
    queue: async (repo): Promise<QueueReport> => ({ generatedAt: '', repo, items }),
    forgetQueue: (repo) => forgotten.push(repo),
  };
  const runner: CrewRunner = {
    isAvailable,
    offer: async (request) => {
      offers.push(request);
      return offer;
    },
  };
  const handle = createApiHandler(withCrewRoutes({ get: {}, post: {} }, queue, runner));
  const send = (body: unknown, headers: Record<string, string> = WRITE) =>
    handle(new Request(BASE, { method: 'POST', headers, body: JSON.stringify(body) }));
  return { handle, send, forgotten, offers };
}

describe('crew routes', () => {
  it('says whether this machine can send a crew', async () => {
    const on = await setUp([]).handle(new Request(BASE));
    const off = await setUp([], {}, false).handle(new Request(BASE));

    assert.deepEqual(await on.json(), { isAvailable: true });
    assert.deepEqual(await off.json(), { isAvailable: false });
  });

  it('proposes a crew for a conflicted pull request, from a fresh read of the queue', async () => {
    const { send, forgotten, offers } = setUp([item(7)]);

    const response = await send({ repo: 'me/app', number: 7 });
    const body = (await response.json()) as { prompt: string; run: typeof TICKET };

    assert.equal(response.status, 201);
    assert.deepEqual(forgotten, ['me/app']);
    assert.deepEqual(body.run, TICKET);
    assert.equal(body.prompt.split('\n')[0], `${CREW_TAG} me/app#7: update-branch`);
    assert.deepEqual(offers, [{ prompt: body.prompt, repo: 'me/app' }]);
  });

  it('fixes checks on a failing pull request', async () => {
    const { send } = setUp([item(8, { bucket: 'failing', mergeable: 'MERGEABLE' })]);

    const body = (await (await send({ repo: 'me/app', number: 8 })).json()) as { prompt: string };

    assert.match(body.prompt, /: fix-checks$/m);
  });

  it('refuses a pull request that is neither conflicted nor failing, before asking the runner', async () => {
    const { send, offers } = setUp([item(9, { bucket: 'unreviewed', mergeable: 'MERGEABLE' })]);

    const response = await send({ repo: 'me/app', number: 9 });

    assert.equal(response.status, 403);
    assert.deepEqual(offers, []);
  });

  it('answers 404 for a pull request no longer in the queue', async () => {
    const response = await setUp([item(7)]).send({ repo: 'me/app', number: 70 });

    assert.equal(response.status, 404);
  });

  it('refuses a branch name it cannot write into the instructions safely', async () => {
    const { send, offers } = setUp([item(7, { branch: '--force' })]);

    assert.equal((await send({ repo: 'me/app', number: 7 })).status, 403);
    assert.deepEqual(offers, []);
  });

  it('passes on why the runner cannot start one', async () => {
    const why = 'That project has no local checkout on this machine.';
    const response = await setUp([item(7)], { why }).send({ repo: 'me/app', number: 7 });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: why });
  });

  it('refuses a bad repo or number, and a send without the write header', async () => {
    const { send } = setUp([item(7)]);

    assert.equal((await send({ repo: '-x/app', number: 7 })).status, 400);
    assert.equal((await send({ repo: 'me/app', number: 'seven' })).status, 400);
    assert.equal(
      (await send({ repo: 'me/app', number: 7 }, { 'content-type': 'application/json' })).status,
      403,
    );
  });
});
