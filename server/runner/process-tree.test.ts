import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type KillContext, processTreeKiller } from './process-tree.ts';

/** A kill context that touches no process: it records each call, and runs `later` at once. */
function recordingContext(platform: NodeJS.Platform, signalError?: Error) {
  const calls: string[] = [];
  const context: KillContext = {
    platform,
    taskkill: (args) => void calls.push(`taskkill ${args.join(' ')}`),
    taskkillNow: (args) => void calls.push(`taskkill now ${args.join(' ')}`),
    signal: (pid, signal) => {
      calls.push(`${signal} ${pid}`);
      if (signalError) throw signalError;
    },
    later: (run, ms) => {
      calls.push(`after ${ms}`);
      run();
    },
  };
  return { context, calls };
}

describe('processTreeKiller', () => {
  it('on Windows, ends the whole tree with taskkill /T /F', () => {
    const { context, calls } = recordingContext('win32');
    const killer = processTreeKiller(context);

    killer.stop(42);
    killer.stopNow(43);

    assert.deepEqual(calls, ['taskkill /pid 42 /T /F', 'taskkill now /pid 43 /T /F']);
  });

  it('elsewhere, signals the process group, and forces it a moment later', () => {
    const { context, calls } = recordingContext('linux');

    processTreeKiller(context).stop(42);

    assert.deepEqual(calls, ['SIGTERM -42', 'after 3000', 'SIGKILL -42']);
  });

  it('elsewhere, stops at once without waiting to force it, for the exit handler', () => {
    const { context, calls } = recordingContext('darwin');

    processTreeKiller(context).stopNow(42);

    assert.deepEqual(calls, ['SIGTERM -42']);
  });

  it('takes a group that has already gone as stopped', () => {
    const gone = Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' });
    const { context } = recordingContext('linux', gone);

    assert.doesNotThrow(() => processTreeKiller(context).stop(42));
  });
});
