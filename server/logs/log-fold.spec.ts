import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LogFold, MAX_FAULTS } from './log-fold.ts';

const SOURCE = { generatedAt: '2026-09-26T10:00:00.000Z', source: 'Rivals Pulse', files: 2 };
const line = (at: string, level: string, message: string) =>
  `${at.replace('T', ' ')},000 (${level}) <app.js> (:1) - ${message}`;

describe('LogFold', () => {
  it('folds repeats into one fault per window, with how often and when', () => {
    const fold = new LogFold();
    fold.addLine('desktop', line('2026-09-20T10:00:00', 'ERROR', 'match 12 failed'));
    fold.addLine('desktop', line('2026-09-22T09:00:00', 'ERROR', 'match 99 failed'));
    fold.addLine('desktop', line('2026-09-21T08:00:00', 'INFO', '== new session =='));
    fold.addLine('desktop', '  at stack (app.js:1:1)');

    const snapshot = fold.snapshot(SOURCE);

    assert.deepEqual(snapshot.faults, [
      {
        id: 1,
        level: 'error',
        window: 'desktop',
        service: null,
        text: 'match # failed',
        count: 2,
        firstAt: '2026-09-20T10:00:00',
        lastAt: '2026-09-22T09:00:00',
        activeDays: 2,
      },
    ]);
    assert.deepEqual(snapshot.windows, [
      {
        id: 'desktop',
        lines: 3,
        error: 2,
        warn: 0,
        info: 1,
        sessions: 1,
        firstAt: '2026-09-20T10:00:00',
        lastAt: '2026-09-22T09:00:00',
      },
    ]);
    assert.deepEqual(snapshot.span, { from: '2026-09-20T10:00:00', to: '2026-09-22T09:00:00' });
    assert.deepEqual(snapshot.timeline, [
      { day: '2026-09-20', error: 1, warn: 0, info: 0 },
      { day: '2026-09-21', error: 0, warn: 0, info: 1 },
      { day: '2026-09-22', error: 1, warn: 0, info: 0 },
    ]);
  });

  it('keeps the loudest faults, errors first, and still counts every one', () => {
    const fold = new LogFold();
    for (let index = 0; index < MAX_FAULTS + 5; index++) {
      fold.addLine('hud', line('2026-09-20T10:00:00', 'WARN', `slow ${'x'.repeat(index)}`));
    }
    fold.addLine('hud', line('2026-09-20T10:00:00', 'WARN', 'loud'));
    fold.addLine('hud', line('2026-09-20T10:00:01', 'WARN', 'loud'));
    fold.addLine('hud', line('2026-09-20T10:00:00', 'ERROR', 'broken'));

    const snapshot = fold.snapshot(SOURCE);

    assert.equal(snapshot.faults.length, MAX_FAULTS);
    assert.deepEqual(
      snapshot.faults.slice(0, 2).map((fault) => fault.text),
      ['broken', 'loud'],
    );
    assert.deepEqual(snapshot.totals, {
      lines: MAX_FAULTS + 8,
      files: 2,
      error: 1,
      warn: MAX_FAULTS + 7,
      info: 0,
      faults: MAX_FAULTS + 7,
      omitted: 7,
    });
  });

  it('lists a window with no lines, worst window first', () => {
    const fold = new LogFold();
    fold.addWindow('empty');
    fold.addLine('quiet', line('2026-09-20T10:00:00', 'INFO', 'hello'));
    fold.addLine('noisy', line('2026-09-20T10:00:00', 'WARN', 'hm'));

    assert.deepEqual(
      fold.snapshot(SOURCE).windows.map((window) => window.id),
      ['noisy', 'quiet', 'empty'],
    );
  });
});
