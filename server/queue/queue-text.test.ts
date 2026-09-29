import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TriagedItem, TriagedQueue } from '../triage/triaged-queue.ts';
import { actedLine, parseQueueArgs, renderQueue, repoFromRemote } from './queue-text.ts';

const item = (number: number, extra: Partial<TriagedItem> = {}): TriagedItem => ({
  number,
  title: `Pull ${number}`,
  url: `https://github.com/me/app/pull/${number}`,
  isDraft: false,
  bucket: 'unreviewed',
  closes: [number + 100],
  failingChecks: 0,
  additions: 1,
  deletions: 0,
  updatedAt: '2026-09-20T00:00:00Z',
  branch: 'b',
  base: 'main',
  mergeable: 'MERGEABLE',
  changedFiles: 1,
  idleDays: 3,
  ageDays: 4,
  isSeen: false,
  hidden: null,
  ...extra,
});
const queue = (items: TriagedItem[]): TriagedQueue => ({
  generatedAt: '2026-09-29T00:00:00Z',
  repo: 'me/app',
  items,
});

describe('parseQueueArgs', () => {
  it('shows the queue by default, for the repository named or the checkout', () => {
    assert.deepEqual(parseQueueArgs([]), {
      repo: null,
      json: false,
      command: { kind: 'show', all: false },
    });
    assert.deepEqual(parseQueueArgs(['me/app', 'all', '--json']), {
      repo: 'me/app',
      json: true,
      command: { kind: 'show', all: true },
    });
  });

  it('reads an action on one pull request, with a snooze of 1 to 90 days', () => {
    assert.deepEqual(parseQueueArgs(['seen', '#12']).command, {
      kind: 'act',
      action: 'seen',
      number: 12,
    });
    assert.deepEqual(parseQueueArgs(['me/app', 'snooze', '7', '3']).command, {
      kind: 'act',
      action: 'snooze',
      number: 7,
      days: 3,
    });
    assert.throws(() => parseQueueArgs(['snooze', '7', '400']), /1 to 90 days/);
    assert.throws(() => parseQueueArgs(['merge', '7']), /Unknown command: merge/);
    assert.throws(() => parseQueueArgs(['dismiss']), /by its number/);
  });
});

describe('repoFromRemote', () => {
  it('reads https and ssh GitHub remotes', () => {
    assert.equal(repoFromRemote('https://github.com/me/app.git\n'), 'me/app');
    assert.equal(repoFromRemote('git@github.com:me/app.git'), 'me/app');
    assert.equal(repoFromRemote('https://gitlab.com/me/app.git'), null);
  });
});

describe('renderQueue', () => {
  it('counts the buckets and lists blocked first, seen ones last, hidden ones left out', () => {
    const text = renderQueue(
      queue([
        item(1, { isSeen: true }),
        item(2, { bucket: 'conflicted', closes: [] }),
        item(3, { hidden: { reason: 'dismissed' } }),
      ]),
      false,
    );
    assert.match(text, /me\/app · 2 in the queue · 1 hidden/);
    assert.match(text, /Cannot merge 1 · Seen already 1/);
    assert.ok(text.indexOf('#2 ') < text.indexOf('#1 '), text);
    assert.match(text, /#2 {2}Cannot merge · 3d idle · closes no issue/);
    assert.doesNotMatch(text, /#3 /);
  });

  it('shows dismissed and snoozed ones with all, marked', () => {
    const text = renderQueue(
      queue([
        item(3, { hidden: { reason: 'dismissed' } }),
        item(4, { hidden: { reason: 'snoozed', until: '2026-10-02T00:00:00Z' } }),
      ]),
      true,
    );
    assert.match(text, /#3 .*\[dismissed\]/);
    assert.match(text, /#4 .*\[snoozed to 2026-10-02\]/);
  });

  it('says so when nothing is waiting', () => {
    assert.match(renderQueue(queue([]), false), /Nothing is waiting on you/);
  });
});

describe('actedLine', () => {
  it('says where the pull request now stands', () => {
    assert.equal(actedLine('seen', 5, { isSeen: true, hidden: null }), '#5 marked seen.');
    assert.equal(
      actedLine('snooze', 5, {
        isSeen: false,
        hidden: { reason: 'snoozed', until: '2026-10-02T00:00:00Z' },
      }),
      '#5 snoozed until 2026-10-02.',
    );
    assert.match(
      actedLine('dismiss', 5, { isSeen: false, hidden: { reason: 'dismissed' } }),
      /new push brings it back/,
    );
    assert.equal(
      actedLine('restore', 5, { isSeen: false, hidden: null }),
      '#5 is back in the queue.',
    );
  });
});
