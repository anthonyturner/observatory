import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { redactStrings, redactText } from './redact.ts';

/** Each input and what pr-starmap's `site/redact.mjs` makes of it (checked against it). */
const CASES: readonly (readonly [string, string])[] = [
  [
    'GET https://alice:hunter2@db.example.com/x failed',
    'GET https://[hidden]@db.example.com/x failed',
  ],
  ['token eyJhbGciOi.eyJzdWIiOiIx.c2lnbmF0dXJl rejected', 'token [hidden] rejected'],
  ['mail bob.smith+test@example.co.uk bounced', 'mail [hidden] bounced'],
  ['Authorization: Bearer abcdef123456 was refused', 'Authorization: [hidden] was refused'],
  ['password=supersecret; next', 'password=[hidden]; next'],
  ['api_key: "k-###-abc" rejected', 'api_key: "[hidden]" rejected'],
  ['{"session": "abc###def"}', '{"session": "[hidden]"}'],
  ['open C:\\Users\\anthony\\AppData\\x failed', 'open [hidden]\\AppData\\x failed'],
  ['read /home/anthony/.ssh/id failed', 'read [hidden]/.ssh/id failed'],
  ['read /Users/anthony/x failed', 'read [hidden]/x failed'],
  ['connect 192.168.1.20 refused', 'connect [hidden] refused'],
  ['connect fe80::1:2:3:4 refused', 'connect fe80::[hidden] refused'],
  ['commit 3f2a9c8e7d6b5a4f3e2d1c0b9a8f failed', 'commit [hidden] failed'],
  ['id Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFi seen', 'id [hidden] seen'],
  ['key ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij leaked', 'key [hidden] leaked'],
  ['sig=abc&next=1', 'sig=[hidden]&next=1'],
  [
    'Nothing secret here: request failed after # retries',
    'Nothing secret here: request failed after # retries',
  ],
];

describe('redactText', () => {
  for (const [text, expected] of CASES) {
    it(`blanks what should be blanked in: ${text}`, () => {
      assert.equal(redactText(text), expected);
    });
  }
});

describe('redactStrings', () => {
  it('scrubs every string however deep, and keeps the shape and other values', () => {
    const logs = {
      source: '/home/anthony/app/logs',
      count: 3,
      faults: [{ text: 'mail bob@example.com bounced', seen: true, at: null }],
    };

    assert.deepEqual(redactStrings(logs), {
      source: '[hidden]/app/logs',
      count: 3,
      faults: [{ text: 'mail [hidden] bounced', seen: true, at: null }],
    });
  });
});
