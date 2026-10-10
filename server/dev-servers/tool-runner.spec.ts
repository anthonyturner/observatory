import assert from 'node:assert/strict';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, it } from 'node:test';
import type { ProcessTreeKiller } from '../runner/process-tree.ts';
import { toolRunner } from './tool-runner.ts';

interface Spawned {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: SpawnOptions;
  readonly child: EventEmitter & { stdin: PassThrough; stdout: PassThrough; stderr: PassThrough };
}

const ENV = { PATH: 'C:/bin', OPENROUTER_API_KEY: 'k', SESSION_SECRET: 's', HOME: 'h' };

function setUp(platform: NodeJS.Platform = 'win32') {
  const spawned: Spawned[] = [];
  const stopped: number[] = [];
  const stoppedNow: number[] = [];
  const timers: { run: () => void; ms: number; cancelled: boolean }[] = [];
  const killer: ProcessTreeKiller = {
    stop: (pid) => void stopped.push(pid),
    stopNow: (pid) => void stoppedNow.push(pid),
  };
  const runner = toolRunner({
    platform,
    env: ENV,
    killer,
    later: (run, ms) => {
      const timer = { run, ms, cancelled: false };
      timers.push(timer);
      return () => void (timer.cancelled = true);
    },
    spawn: (command, args, options) => {
      const child = Object.assign(new EventEmitter(), {
        pid: 40 + spawned.length,
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
      });
      spawned.push({ command, args, options, child });
      return child as unknown as ChildProcess;
    },
  });
  return { runner, spawned, stopped, stoppedNow, timers };
}

const OPTIONS = { signal: new AbortController().signal, limitMs: 1000 };
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('toolRunner', () => {
  it('starts git directly with its arguments, never through a shell, and without a terminal to ask in', async () => {
    const { runner, spawned } = setUp();
    const args = ['-C', 'E:\\repos\\app; calc', 'fetch', 'origin', 'pull/4/head'];

    const running = runner.run({ tool: 'git', args }, OPTIONS);
    const [call] = spawned;
    call?.child.emit('close', 0);
    await running;

    assert.equal(call?.command, 'git');
    assert.deepEqual(call?.args, args);
    assert.notEqual(call?.options.shell, true);
    assert.equal(call?.options.windowsHide, true);
    assert.deepEqual(call?.options.env, { PATH: 'C:/bin', HOME: 'h', GIT_TERMINAL_PROMPT: '0' });
    assert.equal(call?.child.stdin.writableEnded, true);
  });

  it('starts npm as one of its two fixed lines, in the folder, through the shell', async () => {
    const { runner, spawned } = setUp();

    const ci = runner.run({ tool: 'npm', cwd: 'E:\\wt', command: 'ci' }, OPTIONS);
    spawned[0]?.child.emit('close', 0);
    await ci;
    const install = runner.run({ tool: 'npm', cwd: 'E:\\wt', command: 'install' }, OPTIONS);
    spawned[1]?.child.emit('close', 0);
    await install;

    assert.deepEqual(
      spawned.map((each) => [each.command, each.args, each.options.shell, each.options.cwd]),
      [
        ['npm ci', [], true, 'E:\\wt'],
        ['npm install', [], true, 'E:\\wt'],
      ],
    );
  });

  it('puts the command in its own process group elsewhere than Windows, so a kill reaches its children', () => {
    const { runner, spawned } = setUp('linux');

    void runner.run({ tool: 'git', args: ['status'] }, OPTIONS);

    assert.equal(spawned[0]?.options.detached, true);
  });

  it('reports the exit code, what it printed to stdout, and the last line of either stream', async () => {
    const { runner, spawned } = setUp();

    const running = runner.run({ tool: 'git', args: ['rev-parse', 'HEAD'] }, OPTIONS);
    const child = spawned[0]?.child;
    child?.stdout.write('abc123\n');
    child?.stderr.write('warning: something\n');
    await settle();
    child?.emit('close', 3);

    assert.deepEqual(await running, {
      code: 3,
      stdout: 'abc123\n',
      lastLine: 'warning: something',
      hasTimedOut: false,
    });
  });

  it('reports a command that could not start, with why', async () => {
    const { runner, spawned } = setUp();

    const running = runner.run({ tool: 'git', args: ['status'] }, OPTIONS);
    spawned[0]?.child.emit('error', new Error('spawn git ENOENT'));

    assert.deepEqual(await running, {
      code: null,
      stdout: '',
      lastLine: 'spawn git ENOENT',
      hasTimedOut: false,
    });
  });

  it('ends the command that runs past its limit, and says so', async () => {
    const { runner, spawned, stopped, timers } = setUp();

    const running = runner.run({ tool: 'npm', cwd: 'E:\\wt', command: 'ci' }, OPTIONS);
    assert.equal(timers[0]?.ms, 1000);
    timers[0]?.run();
    assert.deepEqual(stopped, [40]);
    spawned[0]?.child.emit('close', null);

    const result = await running;
    assert.equal(result.hasTimedOut, true);
    assert.equal(result.code, null);
  });

  it('cancels the limit once the command is over', async () => {
    const { runner, spawned, timers } = setUp();

    const running = runner.run({ tool: 'git', args: ['status'] }, OPTIONS);
    spawned[0]?.child.emit('close', 0);
    await running;

    assert.equal(timers[0]?.cancelled, true);
  });

  it('ends the command when its signal aborts, and starts nothing for a signal already aborted', async () => {
    const { runner, spawned, stopped } = setUp();
    const stop = new AbortController();

    const running = runner.run(
      { tool: 'git', args: ['fetch'] },
      { ...OPTIONS, signal: stop.signal },
    );
    stop.abort();
    assert.deepEqual(stopped, [40]);
    spawned[0]?.child.emit('close', null);
    const result = await running;
    const late = await runner.run(
      { tool: 'git', args: ['fetch'] },
      { ...OPTIONS, signal: stop.signal },
    );

    assert.equal(result.code, null);
    assert.equal(late.code, null);
    assert.equal(spawned.length, 1);
  });

  it('ends only the commands still running when asked to shut down', async () => {
    const { runner, spawned, stoppedNow } = setUp();
    const finished = runner.run({ tool: 'git', args: ['status'] }, OPTIONS);
    void runner.run({ tool: 'git', args: ['fetch'] }, OPTIONS);
    spawned[0]?.child.emit('close', 0);
    await finished;

    runner.shutdown();

    assert.deepEqual(stoppedNow, [41]);
  });
});
