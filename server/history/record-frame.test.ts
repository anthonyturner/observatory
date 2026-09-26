import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { QueueReport } from '../queue/queue-report.ts';
import type { Frame } from './frames.ts';
import type { HistoryStore } from './history-store.ts';
import { recordFrame } from './record-frame.ts';

const NOW = Date.parse('2026-09-26T12:00:00Z');

const reportOf = (...items: [number, string][]): QueueReport =>
  ({
    generatedAt: 'x',
    repo: 'me/a',
    items: items.map(([number, bucket]) => ({ number, title: `#${number}`, bucket })),
  }) as unknown as QueueReport;

function memoryStore(frames: Frame[] = []): HistoryStore & { frames: Frame[] } {
  return {
    frames,
    read() {
      return this.frames;
    },
    append(_repo, frame) {
      this.frames.push(frame);
    },
  };
}

const states: Record<number, string> = { 1: 'MERGED', 2: 'CLOSED', 3: 'OPEN' };
const github = {
  pullState: async (_repo: string, pull: number) => {
    if (pull === 4) throw new Error('offline');
    return states[pull];
  },
};

describe('recordFrame', () => {
  it('records the queue, and how each pull request that left it left', async () => {
    const store = memoryStore();
    await recordFrame(
      reportOf(
        [1, 'unreviewed'],
        [2, 'failing'],
        [3, 'failing'],
        [4, 'unreviewed'],
        [5, 'conflicted'],
      ),
      store,
      github,
      NOW - 60_000,
    );

    const frame = await recordFrame(reportOf([5, 'failing']), store, github, NOW);

    assert.equal(store.frames.length, 2);
    assert.deepEqual(frame?.items, [{ number: 5, title: '#5', bucket: 'failing' }]);
    // #3 still open past the list's limit, and #4 unreadable: neither is guessed.
    assert.deepEqual(frame?.departed, [
      { number: 1, title: '#1', fate: 'merged' },
      { number: 2, title: '#2', fate: 'closed' },
    ]);
  });

  it('records nothing when nothing moved', async () => {
    const store = memoryStore();
    await recordFrame(reportOf([5, 'failing']), store, github, NOW - 60_000);

    assert.equal(await recordFrame(reportOf([5, 'failing']), store, github, NOW), null);
    assert.equal(store.frames.length, 1);
  });
});
