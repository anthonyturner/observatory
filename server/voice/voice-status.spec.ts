import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ElevenLabsError } from './eleven-labs-error.ts';
import type { ElevenLabs, Voice } from './eleven-labs.ts';
import { voiceStatus } from './voice-status.ts';

const VOICES: Voice[] = [
  { id: 'a1', name: 'Adam' },
  { id: 'z1', name: 'Zoe' },
];
const TEN_MINUTES_MS = 10 * 60_000;

/** An account that lists `list()` and counts how often it was asked. */
function account(isOn: boolean, list: () => Promise<Voice[]>) {
  let calls = 0;
  const voice: ElevenLabs = {
    isOn,
    voices: () => {
      calls++;
      return list();
    },
    speak: async () => assert.fail('not asked to speak'),
    hear: async () => assert.fail('not asked to hear'),
  };
  return { voice, calls: () => calls };
}

const quiet = () => undefined;

describe('voiceStatus', () => {
  it('is off with no key, with no voices, and asks nothing', async () => {
    const { voice, calls } = account(false, async () => VOICES);

    const status = await voiceStatus({ voice, preferredVoice: 'z1' })();

    assert.deepEqual(status, { elevenlabs: 'off', voices: [], defaultVoice: null });
    assert.equal(calls(), 0);
  });

  it('is on with the voices, the first the default', async () => {
    const { voice } = account(true, async () => VOICES);

    const status = await voiceStatus({ voice, preferredVoice: null })();

    assert.deepEqual(status, { elevenlabs: 'on', voices: VOICES, defaultVoice: 'a1' });
  });

  it('defaults to the preferred voice when the account has it, else the first', async () => {
    const { voice } = account(true, async () => VOICES);

    assert.equal((await voiceStatus({ voice, preferredVoice: 'z1' })()).defaultVoice, 'z1');
    assert.equal((await voiceStatus({ voice, preferredVoice: 'gone' })()).defaultVoice, 'a1');
  });

  it('reads a failed list as on, with no voices and the reason', async () => {
    const warned: string[] = [];
    const { voice } = account(true, async () => {
      throw new ElevenLabsError('key', 401);
    });

    const status = await voiceStatus({
      voice,
      preferredVoice: null,
      warn: (message) => void warned.push(message),
    })();

    assert.deepEqual(status, {
      elevenlabs: 'on',
      voices: [],
      defaultVoice: null,
      failed: 'the key was refused',
    });
    assert.equal(warned.length, 1);
  });

  it('keeps the list for ten minutes, and does not keep a failure', async () => {
    let now = 0;
    let isFailing = true;
    const { voice, calls } = account(true, async () => {
      if (isFailing) throw new ElevenLabsError('network', null);
      return VOICES;
    });
    const status = voiceStatus({ voice, preferredVoice: null, warn: quiet, clock: () => now });

    await status();
    isFailing = false;
    await status();
    await status();
    assert.equal(calls(), 2);

    now = TEN_MINUTES_MS;
    await status();
    assert.equal(calls(), 3);
  });
});
