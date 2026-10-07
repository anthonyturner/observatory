import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { sizeOf } from '../queue/pull-size.ts';
import { FIRST_LOAD_EVENTS, firstPage, pageFrom } from './feed-page.ts';
import type { AgentFeedPage } from './feed-types.ts';

const root = mkdtempSync(join(tmpdir(), 'feed-page-'));
after(() => rmSync(root, { recursive: true, force: true }));

let files = 0;
const fileWith = (text: string): string => {
  const file = join(root, `t-${files++}.jsonl`);
  writeFileSync(file, text);
  return file;
};

const said = (words: string): string =>
  `${JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: words }] } })}\n`;
const noted = `${JSON.stringify({ type: 'attachment', attachment: { type: 'file' } })}\n`;

const wordsOf = (page: AgentFeedPage): string[] =>
  page.events.map((event) => (event.message.content[0] as { text: string }).text);

describe('firstPage', () => {
  it('returns the last N events and a cursor at the end of the last whole line', async () => {
    const lines = Array.from({ length: FIRST_LOAD_EVENTS + 30 }, (_, n) => said(`n${n}`)).join('');
    const file = fileWith(`${lines}${noted}{"type":"assist`);

    const page = await firstPage(file);

    assert.equal(page.events.length, FIRST_LOAD_EVENTS);
    assert.equal(wordsOf(page)[0], 'n30');
    assert.equal(wordsOf(page).at(-1), `n${FIRST_LOAD_EVENTS + 29}`);
    assert.equal(page.next, Buffer.byteLength(lines + noted));
    assert.equal(page.isRestart, true);
  });

  it('keeps the newest events that fit under the byte cap', async () => {
    const file = fileWith([said('a'.repeat(400)), said('b'.repeat(400)), said('c')].join(''));

    const page = await firstPage(file, 600);

    assert.deepEqual(wordsOf(page), ['b'.repeat(400), 'c']);
    assert.ok(sizeOf(page) <= 600);
  });

  it('answers no events and no cursor for a transcript that cannot be read', async () => {
    assert.deepEqual(await firstPage(join(root, 'gone.jsonl')), {
      events: [],
      next: null,
      isRestart: true,
    });
  });
});

describe('pageFrom', () => {
  it('reads only up to the last whole line, so a half-written one comes on the next call', async () => {
    const start = said('old');
    const file = fileWith(`${start}${said('new')}{"type":"assistant","mess`);

    const page = await pageFrom(file, Buffer.byteLength(start));

    assert.deepEqual(wordsOf(page), ['new']);
    assert.equal(page.isRestart, false);
    appendFileSync(file, `age":{"content":[{"type":"text","text":"later"}]}}\n`);
    assert.deepEqual(wordsOf(await pageFrom(file, page.next ?? 0)), ['later']);
  });

  it('stops at the byte cap and carries on from there, skipping nothing', async () => {
    const lines = ['a', 'b', 'c', 'd'].map((letter) => said(letter.repeat(300)));
    const file = fileWith(lines.join(''));

    const first = await pageFrom(file, 0, 900);
    const second = await pageFrom(file, first.next ?? 0, 900);

    assert.deepEqual(wordsOf(first), ['a'.repeat(300), 'b'.repeat(300)]);
    assert.ok(sizeOf(first) <= 900);
    assert.equal(first.next, Buffer.byteLength(lines[0] + lines[1]));
    assert.deepEqual(wordsOf(second), ['c'.repeat(300), 'd'.repeat(300)]);
  });

  it('moves the cursor past lines it does not send', async () => {
    const file = fileWith(`${noted}${noted}`);

    assert.deepEqual(await pageFrom(file, 0), {
      events: [],
      next: Buffer.byteLength(noted) * 2,
      isRestart: false,
    });
  });

  it('starts afresh when the transcript is now shorter than the cursor', async () => {
    const file = fileWith(said('anew'));

    const page = await pageFrom(file, 10_000);

    assert.deepEqual(wordsOf(page), ['anew']);
    assert.equal(page.isRestart, true);
  });
});
