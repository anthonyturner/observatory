import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiHandler } from '../http/api-handler.ts';
import { ElevenLabsError } from './eleven-labs-error.ts';
import type { Clip, ElevenLabs, SpeakRequest } from './eleven-labs.ts';
import { withVoiceRoutes } from './voice-routes.ts';

const AUDIO = new Uint8Array([73, 68, 51, 4]);
const VOICES = [{ id: 'a1', name: 'Adam' }];
const quiet = () => undefined;

/** An account that speaks with `speak` and remembers what it was asked to say. */
function account(
  isOn: boolean,
  speak: () => Promise<ArrayBuffer> = async () => AUDIO.buffer,
  hear: () => Promise<string> = async () => 'open the orrery',
) {
  const asked: SpeakRequest[] = [];
  const heard: Clip[] = [];
  const voice: ElevenLabs = {
    isOn,
    voices: async () => VOICES,
    speak: async (request) => {
      asked.push(request);
      return { audio: await speak(), contentType: 'audio/mpeg' };
    },
    hear: async (clip) => {
      heard.push(clip);
      return hear();
    },
  };
  const handle = createApiHandler(
    withVoiceRoutes({ get: {}, post: {} }, { voice, preferredVoice: null, warn: quiet }),
  );
  return { handle, asked, heard };
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

  const hear = (body: unknown, headers: Record<string, string> = { 'x-observatory': '1' }) =>
    new Request('http://x/api/voice/hear', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  const CLIP = {
    audio: Buffer.from([26, 69, 223, 163]).toString('base64'),
    type: 'audio/webm;codecs=opus',
  };

  it('turns a recording into words, passing the audio and its type on', async () => {
    const { handle, heard } = account(true);
    const response = await handle(hear(CLIP));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { text: 'open the orrery' });
    assert.deepEqual([...heard[0].audio], [26, 69, 223, 163]);
    assert.equal(heard[0].contentType, 'audio/webm;codecs=opus');
    assert.deepEqual(heard[0].keyterms, []);
  });

  it('passes the words to expect on', async () => {
    const { handle, heard } = account(true);
    const response = await handle(hear({ ...CLIP, keyterms: ['Jev', 'PR 412'] }));
    assert.equal(response.status, 200);
    assert.deepEqual(heard[0].keyterms, ['Jev', 'PR 412']);
  });

  it('answers 503 with no key, hearing nothing', async () => {
    const { handle, heard } = account(false);
    const response = await handle(hear(CLIP));
    assert.equal(response.status, 503);
    assert.deepEqual(heard, []);
  });

  it('answers 502 with the reason when ElevenLabs fails, such as a key without the permission', async () => {
    const { handle } = account(true, undefined, async () => {
      throw new ElevenLabsError('permission', 401);
    });
    const response = await handle(hear(CLIP));
    assert.equal(response.status, 502);
    const { error } = (await response.json()) as { error: string };
    assert.match(error, /speech-to-text permission/);
  });

  it('answers 400 for a body that is not a recording', async () => {
    const { handle, heard } = account(true);
    for (const body of [
      {},
      { audio: CLIP.audio, type: 'text/html' },
      { audio: '', type: 'audio/webm' },
      { ...CLIP, keyterms: 'Jev' },
      { ...CLIP, keyterms: ['Jev', 412] },
    ]) {
      assert.equal((await handle(hear(body))).status, 400);
    }
    assert.deepEqual(heard, []);
  });

  it('refuses a recording without the write header', async () => {
    const response = await account(true).handle(hear(CLIP, {}));
    assert.notEqual(response.status, 200);
  });

  it('takes a recording larger than the usual body cap', async () => {
    const big = { audio: Buffer.alloc(300 * 1024, 1).toString('base64'), type: 'audio/webm' };
    const response = await account(true).handle(hear(big));
    assert.equal(response.status, 200);
  });
});
