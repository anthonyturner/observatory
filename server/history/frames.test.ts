import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  type Frame,
  QUIET_FRAME_MS,
  fateFrom,
  frameItemsOf,
  isWorthRecording,
  leftSince,
} from './frames.ts';

const AT = Date.parse('2026-09-26T12:00:00Z');
const frame = (items: Frame['items'], at = AT): Frame => ({
  at: new Date(at).toISOString(),
  items,
  departed: [],
});
const a = { number: 1, title: 'One', bucket: 'unreviewed' } as const;
const b = { number: 2, title: 'Two', bucket: 'conflicted' } as const;

describe('isWorthRecording', () => {
  it('records the first frame, and any move, in whatever order', () => {
    assert.equal(isWorthRecording(null, [a], AT), true);
    assert.equal(isWorthRecording(frame([a, b]), [b, a], AT + 1), false);
    assert.equal(isWorthRecording(frame([a, b]), [a, { ...b, bucket: 'failing' }], AT + 1), true);
    assert.equal(isWorthRecording(frame([a, b]), [a], AT + 1), true);
  });

  it('records a quiet queue again after twelve hours, so replay still shows ageing', () => {
    assert.equal(isWorthRecording(frame([a]), [a], AT + QUIET_FRAME_MS - 1), false);
    assert.equal(isWorthRecording(frame([a]), [a], AT + QUIET_FRAME_MS), true);
  });
});

describe('leftSince', () => {
  it('names the pull requests no longer open', () => {
    assert.deepEqual(leftSince(frame([a, b]), [b]), [a]);
    assert.deepEqual(leftSince(null, [a]), []);
  });
});

describe('fateFrom', () => {
  it('reads merged and closed, and nothing else', () => {
    assert.equal(fateFrom('MERGED'), 'merged');
    assert.equal(fateFrom('CLOSED'), 'closed');
    assert.equal(fateFrom('OPEN'), null);
    assert.equal(fateFrom(''), null);
  });
});

describe('frameItemsOf', () => {
  it('keeps number, bucket and a clipped title', () => {
    const report = {
      generatedAt: 'x',
      repo: 'me/a',
      items: [{ number: 3, title: 'x'.repeat(200), bucket: 'failing' }],
    } as unknown as Parameters<typeof frameItemsOf>[0];

    const [item] = frameItemsOf(report);

    assert.equal(item.title.length, 90);
    assert.deepEqual({ ...item, title: '' }, { number: 3, title: '', bucket: 'failing' });
  });
});
