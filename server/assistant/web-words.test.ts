import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { wantsWeb } from './web-words.ts';

describe('wantsWeb', () => {
  it('hears news, the latest and searches', () => {
    for (const text of [
      'AI news',
      "what's the latest on Angular 22",
      'search the web for bun 2',
      'look up Vercel pricing',
      'google it',
      'Headlines?',
    ]) {
      assert.equal(wantsWeb(text), true, text);
    }
  });

  it('leaves questions that need no fresh information alone', () => {
    for (const text of [
      'what is a closure',
      'explain the blocked queue',
      'open the orrery',
      'newsletter template ideas',
    ]) {
      assert.equal(wantsWeb(text), false, text);
    }
  });
});
