import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiHandler } from '../http/api-handler.ts';
import { ElevenLabsError } from './eleven-labs-error.ts';
import type { ElevenLabs, SpeakRequest } from './eleven-labs.ts';
import { withVoiceRoutes } from './voice-routes.ts';

const AUDIO = new Uint8Array([73, 68, 51, 4]);
const VOICES = [{ id: 'a1', name: 'Adam' }];
const quiet = () => undefined;

/** An account that speaks with `speak` and remembers what it was asked to say. */
function account(isOn: boolean, speak: () => Promise<ArrayBuffer> = async () => AUDIO.buffer) {
  const asked: SpeakRequest[] = [];
  const voice: ElevenLabs = {
    isOn,
    voices: async () => VOICES,
    speak: async (request) => {
      asked.push(request);
      return { audio: await speak(), contentType: 'audio/mpeg' };
    },
  };
  const handle = createApiHandler(
    withVoiceRoutes({ get: {}, post: {} }, { voice, preferredVoice: null, warn: quiet }),
  );
  return { handle, asked };
}

const speak = (body: unknown, headers: Record<string, string> = { 'x-observatory': '1' }) =>
  new Request('http://x/api/voice/speak', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const SENTENCE = { text: 'Hello there.', voice: 'a1' };

describe('withVoiceRoutes', () => {
  it('says whether the voice is on, and in which voices', async () => {
    const response = await account(true).handle(new Request('http://x/api/voice'));

    assert.deepEqual(await response.json(), {
      elevenlabs: 'on',
      voices: VOICES,
      defaultVoice: 'a1',
    });
  });

  it('answers a sentence as audio that no cache keeps', async () => {
    const { handle, asked } = account(true);

    const response = await handle(speak(SENTENCE));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), AUDIO);
    assert.deepEqual(asked, [SENTENCE]);
  });

  it('answers 503 with no key, asking nothing', async () => {
    const { handle, asked } = account(false);

    const response = await handle(speak(SENTENCE));

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'ElevenLabs is off: no key' });
    assert.equal(asked.length, 0);
  });

  it('answers 400 for a bad sentence, asking nothing', async () => {
    const { handle, asked } = account(true);

    const response = await handle(speak({ text: 'Hi.', voice: '../voices' }));

    assert.equal(response.status, 400);
    assert.equal(asked.length, 0);
  });

  it('answers 502 with the reason when ElevenLabs fails', async () => {
    const { handle } = account(true, async () => {
      throw new ElevenLabsError('credit', 401, 'quota');
    });

    const response = await handle(speak(SENTENCE));

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      error: 'the ElevenLabs account is out of credit or quota',
    });
  });

  it('refuses a sentence without the write header', async () => {
    const { handle, asked } = account(true);

    const response = await handle(speak(SENTENCE, {}));

    assert.equal(response.status, 403);
    assert.equal(asked.length, 0);
  });
});
