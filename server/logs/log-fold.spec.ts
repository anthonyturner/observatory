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

  describe('cleared', () => {
    const cleared = () => {
      const fold = new LogFold('2026-09-21T12:00:00');
      fold.addWindow('desktop');
      fold.addLine('desktop', line('2026-09-20T10:00:00', 'ERROR', 'old failure'));
      fold.addLine('desktop', line('2026-09-21T12:00:00', 'ERROR', 'match 1 failed'));
      fold.addLine('desktop', line('2026-09-21T12:00:01', 'ERROR', 'match 2 failed'));
      fold.addLine('desktop', line('2026-09-22T09:00:00', 'ERROR', 'match 3 failed'));
      fold.addLine('desktop', line('2026-09-22T09:00:01', 'INFO', '== new session =='));
      return fold.snapshot(SOURCE);
    };

    it('restarts every figure after the clear, a line at the clear itself included', () => {
      const snapshot = cleared();

      assert.equal(snapshot.clearedAt, '2026-09-21T12:00:00');
      assert.deepEqual(snapshot.faults, [
        {
          id: 1,
          level: 'error',
          window: 'desktop',
          service: null,
          text: 'match # failed',
          count: 2,
          firstAt: '2026-09-21T12:00:01',
          lastAt: '2026-09-22T09:00:00',
          activeDays: 2,
        },
      ]);
      assert.deepEqual(snapshot.span, { from: '2026-09-21T12:00:01', to: '2026-09-22T09:00:01' });
      assert.deepEqual(snapshot.totals, {
        lines: 3,
        files: 2,
        error: 2,
        warn: 0,
        info: 1,
        faults: 1,
        omitted: 0,
      });
      assert.deepEqual(snapshot.timeline, [
        { day: '2026-09-21', error: 1, warn: 0, info: 0 },
        { day: '2026-09-22', error: 1, warn: 0, info: 1 },
      ]);
      assert.equal(snapshot.windows[0]?.sessions, 1);
    });

    it('keeps a window whose lines were all cleared, quiet', () => {
      const fold = new LogFold('2026-09-30T00:00:00');
      fold.addWindow('desktop');
      fold.addLine('desktop', line('2026-09-20T10:00:00', 'ERROR', 'old failure'));

      const snapshot = fold.snapshot(SOURCE);

      assert.deepEqual(snapshot.faults, []);
      assert.deepEqual(snapshot.span, { from: null, to: null });
      assert.deepEqual(
        snapshot.windows.map((window) => [window.id, window.lines]),
        [['desktop', 0]],
      );
    });

    it('reads every line when nothing is cleared', () => {
      const fold = new LogFold();
      fold.addLine('desktop', line('2026-09-20T10:00:00', 'ERROR', 'old failure'));

      const snapshot = fold.snapshot(SOURCE);

      assert.equal(snapshot.clearedAt, null);
      assert.equal(snapshot.totals.faults, 1);
    });
  });

  describe('older faults', () => {
    // The newest line is 2026-09-22T12:00:00, so a fault last seen before 2026-09-21T12:00:00
    // is older.
    const folded = (extra: (fold: LogFold) => void = () => undefined) => {
      const fold = new LogFold();
      fold.addWindow('desktop');
      fold.addLine('desktop', line('2026-09-19T08:00:00', 'ERROR', 'fixed 1 failed'));
      fold.addLine('desktop', line('2026-09-19T08:00:01', 'ERROR', 'fixed 2 failed'));
      fold.addLine('desktop', line('2026-09-20T08:00:00', 'WARN', 'slow'));
      fold.addLine('desktop', line('2026-09-21T12:00:00', 'ERROR', 'edge'));
      fold.addLine('desktop', line('2026-09-22T11:00:00', 'ERROR', 'live 1'));
      fold.addLine('desktop', line('2026-09-22T11:30:00', 'INFO', 'hello'));
      fold.addLine('hud', line('2026-09-22T12:00:00', 'INFO', 'newest'));
      extra(fold);
      return fold.snapshot(SOURCE);
    };

    it('sets aside a fault last seen over a day before the newest line, not one exactly a day before', () => {
      const snapshot = folded();

      assert.deepEqual(
        snapshot.faults.map((fault) => fault.text),
        ['edge', 'live #'],
      );
      assert.deepEqual(
        snapshot.older.faults.map((fault) => [fault.id, fault.text, fault.count]),
        [
          [3, 'fixed # failed', 2],
          [4, 'slow', 1],
        ],
      );
      assert.equal(snapshot.older.count, 2);
    });

    it('rebuilds the totals and window counts from what is current', () => {
      const snapshot = folded();

      assert.deepEqual(snapshot.totals, {
        lines: 4,
        files: 2,
        error: 2,
        warn: 0,
        info: 2,
        faults: 2,
        omitted: 0,
      });
      assert.deepEqual(
        snapshot.windows.map(({ id, lines, error, warn, info }) => [id, lines, error, warn, info]),
        [
          ['desktop', 3, 2, 0, 1],
          ['hud', 1, 0, 0, 1],
        ],
      );
    });

    it('tells how much the older faults fired in each window', () => {
      assert.deepEqual(folded().older.windows, [{ id: 'desktop', error: 2, warn: 1 }]);
    });

    it('leaves the day strip counting every line, the older faults included', () => {
      assert.deepEqual(
        folded().timeline.map(({ day, error, warn }) => [day, error, warn]),
        [
          ['2026-09-19', 2, 0],
          ['2026-09-20', 0, 1],
          ['2026-09-21', 1, 0],
          ['2026-09-22', 1, 0],
        ],
      );
    });

    it('caps current and older faults apart, so a stale one never crowds out a live one', () => {
      const snapshot = folded((fold) => {
        for (let index = 0; index < MAX_FAULTS + 5; index++) {
          const at = `2026-09-19T08:${String(index % 60).padStart(2, '0')}:00`;
          fold.addLine('desktop', line(at, 'WARN', `stale ${'x'.repeat(index)}`));
        }
        fold.addLine('desktop', line('2026-09-22T11:59:00', 'WARN', 'live warning'));
      });

      assert.equal(snapshot.faults.length, 3);
      assert.equal(snapshot.totals.omitted, 0);
      assert.equal(snapshot.older.faults.length, MAX_FAULTS);
      assert.equal(snapshot.older.count, MAX_FAULTS + 7);
      assert.equal(
        snapshot.older.windows[0]?.warn,
        1 + MAX_FAULTS + 5,
        'the older counts include the faults past the cap',
      );
    });

    it('sets nothing aside in an empty folder', () => {
      assert.deepEqual(new LogFold().snapshot(SOURCE).older, { count: 0, faults: [], windows: [] });
    });

    it('measures a day from the newest line left after a clear', () => {
      const fold = new LogFold('2026-09-22T00:00:00');
      fold.addLine('desktop', line('2026-09-19T23:00:00', 'ERROR', 'cleared'));
      fold.addLine('desktop', line('2026-09-22T01:00:00', 'ERROR', 'first after'));
      fold.addLine('desktop', line('2026-09-22T02:00:00', 'ERROR', 'second after'));

      const snapshot = fold.snapshot(SOURCE);

      assert.equal(snapshot.faults.length, 2);
      assert.equal(snapshot.older.count, 0);
    });
  });
});
