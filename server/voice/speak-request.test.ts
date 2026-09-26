import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequest } from '../http/api-handler.ts';
import { MAX_SPEECH_LENGTH, speakRequestFrom } from './speak-request.ts';

const refuses = (body: unknown, message: RegExp) =>
  assert.throws(
    () => speakRequestFrom(body),
    (error: Error) => error instanceof BadRequest && message.test(error.message),
  );

describe('speakRequestFrom', () => {
  it('reads the words, trimmed, and the voice', () => {
    assert.deepEqual(speakRequestFrom({ text: '  Hello there.  ', voice: 'Abc123' }), {
      text: 'Hello there.',
      voice: 'Abc123',
    });
  });

  it('takes a sentence up to the limit, and refuses one past it', () => {
    const voice = 'abc';
    assert.equal(
      speakRequestFrom({ text: 'x'.repeat(MAX_SPEECH_LENGTH), voice }).text.length,
      1000,
    );
    refuses({ text: 'x'.repeat(MAX_SPEECH_LENGTH + 1), voice }, /longer than 1000 characters/);
  });

  it('refuses nothing to say', () => {
    refuses({ text: '   ', voice: 'abc' }, /nothing to say/);
    refuses({ voice: 'abc' }, /nothing to say/);
  });

  it('refuses anything but a voice id, so no other path can be reached', () => {
    for (const voice of ['', '../voices', 'a/b', 'a'.repeat(65), 7, null]) {
      refuses({ text: 'Hi.', voice }, /not a voice id/);
    }
  });

  it('refuses a body that is not an object', () => {
    refuses([], /body must be an object/);
    refuses('Hi.', /body must be an object/);
  });
});
