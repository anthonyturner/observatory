import assert from 'node:assert/strict';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, it } from 'node:test';
import type { Spawner } from '../runner/claude-launcher.ts';
import { shellLauncher } from './dev-launcher.ts';

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

const ENV = { PATH: 'C:/bin', OPENROUTER_API_KEY: 'k', SESSION_SECRET: 's', HOME: 'h' };

describe('shellLauncher', () => {
  it('runs the line through the shell in the folder, hidden, with its stdin left open', () => {
    const { spawn, calls } = recordingSpawner();

    const process = shellLauncher({ spawn, platform: 'win32', env: ENV })(
      'E:\\repos\\app',
      'npm run dev',
    );

    assert.equal(process.pid, 7);
    const [call] = calls;
    assert.equal(call?.command, 'npm run dev');
    assert.deepEqual(call?.args, []);
    assert.equal(call?.options.cwd, 'E:\\repos\\app');
    assert.equal(call?.options.shell, true);
    assert.equal(call?.options.windowsHide, true);
    assert.equal(call?.options.detached, false);
    assert.deepEqual(call?.options.stdio, ['pipe', 'pipe', 'pipe']);
  });

  it('puts the server in its own process group elsewhere, so a kill reaches its children', () => {
    const { spawn, calls } = recordingSpawner();

    shellLauncher({ spawn, platform: 'linux', env: ENV })('/repos/app', 'npm start');

    assert.equal(calls[0]?.options.detached, true);
  });

  it('withholds the API’s own credentials from the project', () => {
    const { spawn, calls } = recordingSpawner();

    shellLauncher({ spawn, platform: 'linux', env: ENV })('/repos/app', 'npm start');

    assert.deepEqual(calls[0]?.options.env, { PATH: 'C:/bin', HOME: 'h' });
  });
});
