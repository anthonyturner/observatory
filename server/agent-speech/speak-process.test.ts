import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  type ProcessIdentity,
  type ProcessProbe,
  identityFrom,
  speakProcessCheck,
} from './speak-process.ts';

const TICKS = '639012345678901234';
const SPEAK: ProcessIdentity = {
  startTicks: TICKS,
  commandLine: 'powershell.exe -File C:\\x\\scripts\\speak.ps1 -Drain',
};

/** A probe that knows one process, `pid` 42, and counts the costly questions. */
function probeOf(identity: ProcessIdentity | null, alive = new Set([42])) {
  const asked: number[] = [];
  const probe: ProcessProbe = {
    isAlive: (pid) => alive.has(pid),
    identify: async (pid) => {
      asked.push(pid);
      return identity;
    },
  };
  return { probe, asked, alive };
}

describe('speakProcessCheck', () => {
  it('knows a live speak.ps1 by its id, start time and command line', async () => {
    const { probe } = probeOf(SPEAK);
    const isSpeaking = speakProcessCheck(probe);

    assert.equal(await isSpeaking(`42|${TICKS}|auto\r\n`), true);
    assert.equal(await isSpeaking(`42|${TICKS}`), true);
  });

  it('refuses a recycled id, another program, a dead id or a stamp it cannot read', async () => {
    const recycled = speakProcessCheck(probeOf({ ...SPEAK, startTicks: '1' }).probe);
    const other = speakProcessCheck(probeOf({ ...SPEAK, commandLine: 'code.exe' }).probe);
    const { probe, asked } = probeOf(SPEAK, new Set());
    const dead = speakProcessCheck(probe);
    const anyone = speakProcessCheck(probeOf(SPEAK).probe);

    assert.equal(await recycled(`42|${TICKS}|auto`), false);
    assert.equal(await other(`42|${TICKS}|auto`), false);
    assert.equal(await dead(`42|${TICKS}|auto`), false);
    assert.deepEqual(asked, []);
    for (const stamp of ['', 'nonsense', `0|${TICKS}`, `x|${TICKS}`, `42|${TICKS}|a|b`]) {
      assert.equal(await anyone(stamp), false, stamp);
    }
  });

  it('asks who the process is once per stamp, not on every poll', async () => {
    const { probe, asked } = probeOf(SPEAK);
    const isSpeaking = speakProcessCheck(probe);

    for (let poll = 0; poll < 5; poll++) await isSpeaking(`42|${TICKS}|auto`);

    assert.deepEqual(asked, [42]);
  });

  it('notices at once when the process ends, without asking again', async () => {
    const { probe, asked, alive } = probeOf(SPEAK);
    const isSpeaking = speakProcessCheck(probe);
    await isSpeaking(`42|${TICKS}|auto`);

    alive.clear();

    assert.equal(await isSpeaking(`42|${TICKS}|auto`), false);
    assert.deepEqual(asked, [42]);
  });

  it('asks again after a while, in case the id has gone to another process', async () => {
    const { probe, asked } = probeOf(SPEAK);
    let clock = 0;
    const isSpeaking = speakProcessCheck(probe, () => clock);
    await isSpeaking(`42|${TICKS}|auto`);

    clock = 29_000;
    await isSpeaking(`42|${TICKS}|auto`);
    clock = 31_000;
    await isSpeaking(`42|${TICKS}|auto`);

    assert.deepEqual(asked, [42, 42]);
  });
});

describe('identityFrom', () => {
  it('reads the start ticks and the command line from the probe script', () => {
    assert.deepEqual(identityFrom(`${TICKS}\r\npowershell -File speak.ps1\r\n`), {
      startTicks: TICKS,
      commandLine: 'powershell -File speak.ps1',
    });
  });

  it('reads anything else as nobody', () => {
    assert.equal(identityFrom(''), null);
    assert.equal(identityFrom('Get-Process : Cannot find a process'), null);
  });
});
