import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { agentSpeechReader } from './agent-speech-state.ts';

const LIVE_PLAYER = '42|639012345678901234|auto';
const LIVE_DRAINER = '43|639012345678901235';

describe('agentSpeechReader', () => {
  let root = '';
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'observatory-agent-speak-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  /** A reader whose only live speak.ps1 processes are the two stamps above. */
  const reader = () =>
    agentSpeechReader({
      root,
      isSpeakProcess: async (stamp) => [LIVE_PLAYER, LIVE_DRAINER].includes(stamp),
    });
  const put = (name: string, text: string): void => writeFileSync(join(root, name), `${text}\r\n`);
  const queueLine = (name: string): void => {
    mkdirSync(join(root, 'queue'), { recursive: true });
    writeFileSync(join(root, 'queue', name), 'hello');
  };

  it('reads an empty or missing folder as quiet', async () => {
    const quiet = { busy: false, speaking: false, paused: false, queued: false };

    assert.deepEqual(await reader().read(), quiet);
    rmSync(root, { recursive: true, force: true });
    assert.deepEqual(await reader().read(), quiet);
  });

  it('is busy while a live player speaks', async () => {
    put('.tts.pid', LIVE_PLAYER);
    put('.tts.ctl', 'play');

    assert.deepEqual(await reader().read(), {
      busy: true,
      speaking: true,
      paused: false,
      queued: false,
    });
  });

  it('is not busy while Anthony has it paused, even with more queued', async () => {
    put('.tts.pid', LIVE_PLAYER);
    put('.tts.ctl', 'pause');
    queueLine('0001__s__x.txt');

    assert.deepEqual(await reader().read(), {
      busy: false,
      speaking: true,
      paused: true,
      queued: true,
    });
  });

  it('is busy between lines: a line queued, or a drainer alive', async () => {
    queueLine('0001__s__x.txt');
    assert.deepEqual(await reader().read(), {
      busy: true,
      speaking: false,
      paused: false,
      queued: true,
    });

    rmSync(join(root, 'queue'), { recursive: true });
    put('.tts.drain.pid', LIVE_DRAINER);
    assert.equal((await reader().read()).busy, true);
  });

  it('reads stale files as false', async () => {
    put('.tts.pid', '7|1|auto');
    put('.tts.drain.pid', '8|2');
    queueLine('notes.tmp');

    assert.deepEqual(await reader().read(), {
      busy: false,
      speaking: false,
      paused: false,
      queued: false,
    });
  });
});
