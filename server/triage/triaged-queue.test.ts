import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequest } from '../http/api-server.ts';
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
    },
  ],
};

function memoryStore(): TriageStore & { state: TriageState } {
  return {
    state: EMPTY_TRIAGE,
    read() {
      return this.state;
    },
    write(_repo, state) {
      this.state = state;
    },
  };
}

describe('recordTriage and withTriage', () => {
  it('records an action and shows it in the queue at once', () => {
    const store = memoryStore();

    const result = recordTriage({ repo: 'me/a', number: 7, action: 'seen' }, report, store, NOW);

    assert.deepEqual(result, { number: 7, isSeen: true, hidden: null });
    assert.equal(withTriage(report, store, NOW).items[0].isSeen, true);
  });

  it('refuses a pull request that is not open in the queue', () => {
    assert.throws(
      () => recordTriage({ repo: 'me/a', number: 99, action: 'seen' }, report, memoryStore(), NOW),
      BadRequest,
    );
  });
});
