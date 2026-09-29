import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { localElevenLabs } from './eleven-labs-settings.ts';

const folder = mkdtempSync(join(tmpdir(), 'observatory-voice-'));
const file = join(folder, '.env');
const missing = join(folder, 'missing.env');
writeFileSync(file, 'ELEVENLABS_OBSERVATORY_KEY=from-file\nELEVENLABS_VOICE_ID=fileVoice\n');

describe('localElevenLabs', () => {
  it('takes each setting from the environment first, then the file', () => {
    assert.deepEqual(localElevenLabs({ ELEVENLABS_OBSERVATORY_KEY: 'from-env' }, file), {
      key: 'from-env',
      preferredVoice: 'fileVoice',
    });
  });

  it('ignores the shared ELEVENLABS_API_KEY that other apps set', () => {
    assert.equal(localElevenLabs({ ELEVENLABS_API_KEY: 'other-app' }, file).key, 'from-file');
    assert.equal(localElevenLabs({ ELEVENLABS_API_KEY: 'other-app' }, missing).key, null);
  });

  it('reads none of either with neither', () => {
    assert.deepEqual(localElevenLabs({}, missing), { key: null, preferredVoice: null });
  });
});
