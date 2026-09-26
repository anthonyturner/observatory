import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiHandler } from '../http/api-handler.ts';
import type { QueueReport } from '../queue/queue-report.ts';
import { EMPTY_TRIAGE, type TriageState } from '../triage/triage.ts';
import type { TriageStore } from '../triage/triage-store.ts';
import type { ApiReads } from './api-reads.ts';
import { ownerRoutes } from './api-routes.ts';

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
      additions: 1,
      deletions: 0,
      updatedAt: '2026-09-25T00:00:00Z',
      idleDays: 1,
      ageDays: 1,
    },
  ],
};

const reads = {
  queue: async () => queue,
  pull: async (repo: string, number: number) => ({ repo, number }),
  logs: async (repo: string) => ({ configured: false, reason: 'not-set', repo }),
} as unknown as ApiReads;

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
  const handle = createApiHandler(ownerRoutes(reads, memoryTriage()));
  const get = async (path: string) => (await handle(new Request(`http://x${path}`))).json();

  it('reads a pull request by repository and number', async () => {
    assert.deepEqual(await get('/api/pull?repo=me/app&number=7'), { repo: 'me/app', number: 7 });
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
