import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ElevenLabsError } from './eleven-labs-error.ts';
import { elevenLabs } from './eleven-labs.ts';

const KEY = 'xi-test-key-0123';
const AUDIO = new Uint8Array([73, 68, 51, 4]);

interface Sent {
  readonly url: string;
  readonly init: RequestInit;
}

/** A fetch that answers each call with the next response, remembering what was sent. */
function fakeFetch(...responses: (() => Response)[]) {
  const sent: Sent[] = [];
  const send = async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    return next();
  };
  return { sent, fetch: send as typeof fetch };
}

const failing = (error: Error) =>
  (async () => {
    throw error;
  }) as typeof fetch;

const noSleep = async () => undefined;

const audio = () => new Response(AUDIO, { headers: { 'content-type': 'audio/mpeg' } });

const speakWith = (send: typeof fetch) =>
  elevenLabs({ key: KEY, fetch: send, sleep: noSleep }).speak({ text: 'Hi.', voice: 'abc123' });

const hasReason = (reason: string) => (error: ElevenLabsError) => error.reason === reason;

describe('elevenLabs', () => {
  it('lists the voices by name, with the key in its own header only', async () => {
    const { sent, fetch } = fakeFetch(() =>
      Response.json({
        voices: [
          { voice_id: 'z1', name: 'Zoe', category: 'premade' },
          { voice_id: 'a1', name: 'Adam' },
          { voice_id: 7, name: 'not a voice' },
        ],
      }),
    );

    const voices = await elevenLabs({ key: KEY, fetch }).voices();

    assert.deepEqual(voices, [
      { id: 'a1', name: 'Adam' },
      { id: 'z1', name: 'Zoe' },
    ]);
    assert.equal(sent[0].url, 'https://api.elevenlabs.io/v1/voices');
    assert.equal(sent[0].init.method, 'GET');
    const headers = new Headers(sent[0].init.headers);
    assert.equal(headers.get('xi-api-key'), KEY);
    assert.equal(headers.get('authorization'), null);
    assert.ok(!sent[0].url.includes(KEY));
  });

  it('speaks a sentence in the flash model, as MP3, and gives back the bytes', async () => {
    const { sent, fetch } = fakeFetch(audio);

    const speech = await speakWith(fetch);

    assert.deepEqual(new Uint8Array(speech.audio), AUDIO);
    assert.equal(speech.contentType, 'audio/mpeg');
    assert.equal(
      sent[0].url,
      'https://api.elevenlabs.io/v1/text-to-speech/abc123?output_format=mp3_44100_128',
    );
    assert.equal(sent[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(String(sent[0].init.body)), {
      text: 'Hi.',
      model_id: 'eleven_flash_v2_5',
    });
    assert.ok(!String(sent[0].init.body).includes(KEY));
  });

  it('is off with no key, and fails every call with the reason key, sending nothing', async () => {
    const { sent, fetch } = fakeFetch();
    const voice = elevenLabs({ key: null, fetch });

    assert.equal(voice.isOn, false);
    await assert.rejects(voice.voices(), hasReason('key'));
    await assert.rejects(voice.speak({ text: 'Hi.', voice: 'abc' }), hasReason('key'));
    assert.equal(sent.length, 0);
  });

  it('tries a rate limit once more, waiting at most a second and a half', async () => {
    const waits: number[] = [];
    const busy = () => new Response('', { status: 429, headers: { 'retry-after': '30' } });
    const { sent, fetch } = fakeFetch(busy, audio);

    const voice = elevenLabs({ key: KEY, fetch, sleep: async (ms) => void waits.push(ms) });
    await voice.speak({ text: 'Hi.', voice: 'abc' });

    assert.equal(sent.length, 2);
    assert.deepEqual(waits, [1500]);
  });

  it('gives up after one retry with the reason busy', async () => {
    const busy = () => new Response('', { status: 429 });
    const { sent, fetch } = fakeFetch(busy, busy);

    await assert.rejects(speakWith(fetch), hasReason('busy'));
    assert.equal(sent.length, 2);
  });

  it('names the reason from the status, and never echoes the key', async () => {
    const said = { detail: { status: 'invalid_api_key', message: `Bad key ${KEY}` } };
    const { fetch } = fakeFetch(() => Response.json(said, { status: 401 }));

    await assert.rejects(speakWith(fetch), (error: ElevenLabsError) => {
      assert.equal(error.reason, 'key');
      assert.equal(error.words, 'the key was refused');
      assert.equal(error.status, 401);
      assert.ok(!error.message.includes(KEY), error.message);
      assert.match(error.message, /\[key\]/);
      return true;
    });
  });

  it('reads a spent quota as out of credit, though ElevenLabs answers it 401', async () => {
    const said = { detail: { status: 'quota_exceeded', message: 'You have 3 credits left.' } };
    const { fetch } = fakeFetch(() => Response.json(said, { status: 401 }));

    await assert.rejects(speakWith(fetch), hasReason('credit'));
  });

  it('reads a voice the account lacks, and a request it could not validate', async () => {
    const missing = fakeFetch(() => Response.json({ detail: 'not found' }, { status: 404 }));
    const invalid = fakeFetch(() =>
      Response.json({ detail: [{ msg: 'field required' }] }, { status: 422 }),
    );

    await assert.rejects(speakWith(missing.fetch), hasReason('voice'));
    await assert.rejects(speakWith(invalid.fetch), (error: ElevenLabsError) => {
      assert.equal(error.reason, 'input');
      assert.match(error.message, /field required/);
      return true;
    });
  });

  it('scrubs a network failure that carries the key', async () => {
    const fetch = failing(new Error(`connect failed with ${KEY}`));

    await assert.rejects(speakWith(fetch), (error: ElevenLabsError) => {
      assert.equal(error.reason, 'network');
      assert.ok(!error.message.includes(KEY), error.message);
      return true;
    });
  });

  it('reads a timeout as one', async () => {
    await assert.rejects(
      speakWith(failing(new DOMException('timed out', 'TimeoutError'))),
      hasReason('timeout'),
    );
  });

  it('refuses a voice list it cannot read', async () => {
    const { fetch } = fakeFetch(() => Response.json({ nothing: true }));

    await assert.rejects(elevenLabs({ key: KEY, fetch }).voices(), hasReason('shape'));
  });

  it('hears in English with Scribe v2, sending the keyterms Scribe takes', async () => {
    const { sent, fetch: send } = fakeFetch(() => Response.json({ text: ' dismiss PR 412 ' }));
    const voice = elevenLabs({ key: KEY, fetch: send, sleep: noSleep });

    const heard = await voice.hear({
      audio: new Uint8Array([26, 69, 223, 163]),
      contentType: 'audio/webm',
      keyterms: ['Jev', 'PR 412', 'a[b'],
    });

    assert.equal(heard, 'dismiss PR 412');
    assert.equal(sent[0].url, 'https://api.elevenlabs.io/v1/speech-to-text');
    const form = sent[0].init.body;
    assert.ok(form instanceof FormData);
    assert.equal(form.get('model_id'), 'scribe_v2');
    assert.equal(form.get('language_code'), 'en');
    assert.deepEqual(form.getAll('keyterms'), ['Jev', 'PR 412']);
    assert.ok(form.get('file') instanceof Blob);
  });
});
