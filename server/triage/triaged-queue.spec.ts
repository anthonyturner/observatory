import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequest } from '../http/api-handler.ts';
import type { QueueReport } from '../queue/queue-report.ts';
import { EMPTY_TRIAGE, type TriageState } from './triage.ts';
import type { TriageStore } from './triage-store.ts';
import { recordTriage, withTriage } from './triaged-queue.ts';

const NOW = Date.parse('2026-09-26T12:00:00Z');

const report: QueueReport = {
  generatedAt: '2026-09-26T11:59:00Z',
  repo: 'me/a',
  items: [
    {
      number: 7,
      title: 'A change',
      url: 'https://github.com/me/a/pull/7',
      isDraft: false,
      bucket: 'unreviewed',
      closes: [1],
      failingChecks: 0,
      additions: 1,
      deletions: 1,
      updatedAt: '2026-09-20T00:00:00Z',
      idleDays: 6,
      ageDays: 9,
      branch: 'feat/x',
      headSha: 'a'.repeat(40),
      base: 'main',
      mergeable: 'MERGEABLE',
      changedFiles: 1,
    },
  ],
};

function memoryStore(): TriageStore & { state: TriageState } {
  return {
    state: EMPTY_TRIAGE,
    async read() {
      return this.state;
    },
    async write(_repo, state) {
      this.state = state;
    },
  };
}

describe('recordTriage and withTriage', () => {
  it('records an action and shows it in the queue at once', async () => {
    const store = memoryStore();

    const result = await recordTriage(
      { repo: 'me/a', number: 7, action: 'seen' },
      report,
      store,
      NOW,
    );

    assert.deepEqual(result, { number: 7, isSeen: true, hidden: null, lookedSha: 'a'.repeat(40) });
    assert.equal((await withTriage(report, store, NOW)).items[0].isSeen, true);
  });

  it('records the head the screen showed on a look, else the queue’s', async () => {
    const store = memoryStore();
    const look = { repo: 'me/a', number: 7, action: 'look' } as const;

    const shown = await recordTriage({ ...look, sha: 'c'.repeat(40) }, report, store, NOW);
    assert.equal(shown.lookedSha, 'c'.repeat(40));

    const queued = await recordTriage(look, report, store, NOW);
    assert.equal(queued.lookedSha, 'a'.repeat(40));
    assert.equal((await withTriage(report, store, NOW)).items[0].lookedSha, 'a'.repeat(40));
  });

  it('refuses a pull request that is not open in the queue', async () => {
    await assert.rejects(
      recordTriage({ repo: 'me/a', number: 99, action: 'seen' }, report, memoryStore(), NOW),
      BadRequest,
    );
  });
});
