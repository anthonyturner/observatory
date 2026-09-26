import assert from 'node:assert/strict';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, it } from 'node:test';
import { CLAUDE_ARGS } from './claude-command.ts';
import { claudeLauncher, cmdArg, type Spawner } from './claude-launcher.ts';

interface Spawned {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: SpawnOptions;
}

/** A spawner that starts nothing: it records the call and hands back a bare child. */
function recordingSpawner(): { spawn: Spawner; calls: Spawned[] } {
  const calls: Spawned[] = [];
  const spawn: Spawner = (command, args, options) => {
    calls.push({ command, args, options });
    const child = Object.assign(new EventEmitter(), {
      pid: 7,
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
    });
    return child as unknown as ChildProcess;
  };
  return { spawn, calls };
}

const ENV = { PATH: 'C:/bin', OPENROUTER_API_KEY: 'k', Observatory_Push_Token: 't', HOME: 'h' };

describe('claudeLauncher', () => {
  it('is null without a claude to start', () => {
    assert.equal(claudeLauncher(null), null);
  });

  it('starts an executable directly with the fixed flags, in the folder', () => {
    const { spawn, calls } = recordingSpawner();
    const launch = claudeLauncher(
      { file: '/usr/bin/claude', isShim: false },
      { spawn, platform: 'linux', env: ENV },
    );

    const process = launch?.('/repos/app');

    assert.equal(process?.pid, 7);
    const [call] = calls;
    assert.equal(call?.command, '/usr/bin/claude');
    assert.deepEqual(call?.args, CLAUDE_ARGS);
    assert.equal(call?.options.cwd, '/repos/app');
    assert.equal(call?.options.shell, false);
    assert.equal(call?.options.detached, true);
  });

  it('starts a Windows shim through cmd.exe as one line of fixed flags, not detached', () => {
    const { spawn, calls } = recordingSpawner();
    const launch = claudeLauncher(
      { file: 'C:\\npm\\claude.cmd', isShim: true },
      { spawn, platform: 'win32', env: ENV },
    );

    launch?.('E:\\repos\\app');

    const [call] = calls;
    assert.equal(call?.command, `"C:\\npm\\claude.cmd" ${CLAUDE_ARGS.join(' ')}`);
    assert.deepEqual(call?.args, []);
    assert.equal(call?.options.shell, true);
    assert.equal(call?.options.detached, false);
  });

  it('never passes a permission flag, and keeps the server’s credentials from the run', () => {
    const { spawn, calls } = recordingSpawner();
    claudeLauncher(
      { file: 'claude', isShim: false },
      { spawn, platform: 'linux', env: ENV },
    )?.('/repos/app');

    assert.ok(!CLAUDE_ARGS.some((arg) => /permission/i.test(arg)));
    assert.deepEqual(calls[0]?.options.env, { PATH: 'C:/bin', HOME: 'h' });
  });
});

describe('cmdArg', () => {
  it('passes a plain flag, quotes a spaced one, and refuses what cmd.exe would act on', () => {
    assert.equal(cmdArg('--output-format'), '--output-format');
    assert.equal(cmdArg('two words'), '"two words"');
    for (const unsafe of ['a&b', '%PATH%', 'a|b', 'a"b', 'a>b', 'a^b', 'a!b']) {
      assert.throws(() => cmdArg(unsafe), /not a safe flag/);
    }
  });
});
