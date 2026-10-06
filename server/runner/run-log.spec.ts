import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RunLog, type RunEvent } from './run-log.ts';

const AT = 5;
const parse = (line: string | null): RunEvent | null =>
  line === null ? null : (JSON.parse(line) as RunEvent);

/** Every line `log` sends a follower from `from`, parsed; null marks the end. */
function followed(log: RunLog, from: number): (RunEvent | null)[] {
  const seen: (RunEvent | null)[] = [];
  log.follow(from, (line) => seen.push(parse(line)));
  return seen;
}

describe('RunLog', () => {
  it('numbers events from 0 and replays them from an offset', () => {
    const log = new RunLog(1024, () => AT);
    log.append('state', { state: 'starting' });
    log.append('text', 'one');
    log.append('text', 'two');

    assert.equal(log.count, 3);
    assert.deepEqual(followed(log, 1), [
      { n: 1, at: AT, kind: 'text', data: 'one' },
      { n: 2, at: AT, kind: 'text', data: 'two' },
    ]);
  });

  it('sends new events to a follower as they come, then null when closed', () => {
    const log = new RunLog(1024, () => AT);
    const seen = followed(log, 0);

    log.append('stderr', 'warning');
    log.close();
    log.append('text', 'after the end');

    assert.deepEqual(seen, [{ n: 0, at: AT, kind: 'stderr', data: 'warning' }, null]);
  });

  it('replays and ends at once for a follower that arrives after the close', () => {
    const log = new RunLog(1024, () => AT);
    log.append('text', 'only');
    log.close();

    assert.deepEqual(followed(log, 0), [{ n: 0, at: AT, kind: 'text', data: 'only' }, null]);
  });

  it('stops sending to a follower that stopped following', () => {
    const log = new RunLog(1024, () => AT);
    const seen: (string | null)[] = [];
    const unfollow = log.follow(0, (line) => seen.push(line));

    unfollow();
    log.append('text', 'unseen');

    assert.deepEqual(seen, []);
  });

  it('keeps only keepBytes of the newest, and tells a follower how many were dropped', () => {
    const line = JSON.stringify({ n: 0, at: AT, kind: 'text', data: 'x'.repeat(20) });
    const log = new RunLog(line.length * 2, () => AT);
    for (let index = 0; index < 5; index++) log.append('text', 'x'.repeat(20));

    const seen = followed(log, 0);

    assert.deepEqual(seen[0], { n: 2, at: AT, kind: 'trimmed', data: { dropped: 3 } });
    assert.deepEqual(
      seen.slice(1).map((event) => event?.n),
      [3, 4],
    );
    assert.deepEqual(
      followed(log, 4).map((event) => event?.n),
      [4],
    );
  });

  it('always keeps the newest event, however large', () => {
    const log = new RunLog(10, () => AT);
    log.append('text', 'a much longer line than ten bytes');

    assert.equal(followed(log, 0)[0]?.kind, 'text');
  });
});
