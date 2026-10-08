import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hiddenWeather, pullWeatherOf, weatherReport } from './pull-weather.ts';
import type { QueueItem, QueueReport } from './queue-report.ts';

const TODO_DIFF = [
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1 +1,2 @@',
  ' run();',
  '+// TODO: later',
  '',
].join('\n');

const item = (number: number): QueueItem => ({ number, headSha: `sha${number}` }) as QueueItem;
const queue = (...numbers: number[]): QueueReport => ({
  generatedAt: '2026-10-08T00:00:00Z',
  repo: 'me/app',
  items: numbers.map(item),
});

describe('pullWeatherOf', () => {
  it('reads the flags from the diff at the head it was given', async () => {
    const weather = await pullWeatherOf(7, 'abc', async () => TODO_DIFF);
    assert.deepEqual(
      [weather.number, weather.headSha, weather.scanned, weather.flags.map((flag) => flag.kind)],
      [7, 'abc', true, ['untracked-todo']],
    );
  });

  it('is not scanned, not clear, when there is no diff to read', async () => {
    assert.deepEqual(await pullWeatherOf(7, 'abc', async () => null), {
      number: 7,
      headSha: 'abc',
      scanned: false,
      flags: [],
    });
  });

  it('is clear when the diff adds nothing flagged', async () => {
    const weather = await pullWeatherOf(7, 'abc', async () => '');
    assert.deepEqual([weather.scanned, weather.flags], [true, []]);
  });
});

describe('weatherReport', () => {
  it('reads each pull request at its own head, in queue order, a few at a time', async () => {
    let running = 0;
    let most = 0;
    const asked: string[] = [];
    const report = await weatherReport(queue(1, 2, 3, 4, 5, 6, 7, 8, 9), async (number, sha) => {
      asked.push(`${number}@${sha}`);
      running++;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running--;
      return { number, headSha: sha, scanned: true, flags: [] };
    });

    assert.deepEqual(
      report.pulls.map((pull) => pull.number),
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
    );
    assert.equal(asked[0], '1@sha1');
    assert.ok(most <= 4, `read ${most} diffs at once`);
    assert.deepEqual([report.repo, report.hidden], ['me/app', false]);
  });
});

describe('hiddenWeather', () => {
  it('lists every pull request as not scanned, reading nothing', () => {
    assert.deepEqual(hiddenWeather(queue(3)), {
      repo: 'me/app',
      hidden: true,
      pulls: [{ number: 3, headSha: 'sha3', scanned: false, flags: [] }],
    });
  });
});
