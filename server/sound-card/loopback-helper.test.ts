import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, it } from 'node:test';
import { HELPER_ARGS, type HelperProcess, wasapiLoopback } from './loopback-helper.ts';
import type { PcmEvents } from './pcm-source.ts';

/** A helper process the test plays the part of. Nothing is started. */
function fakeHelper() {
  const closes = new EventEmitter();
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const state = { isKilled: false, isStdinClosed: false, command: '', args: [] as string[] };
  stdin.on('finish', () => (state.isStdinClosed = true));
  const helperProcess: HelperProcess = {
    stdin,
    stdout,
    stderr,
    kill: () => void (state.isKilled = true),
    onClose: (listener) => void closes.on('close', listener),
    onError: (listener) => void closes.on('error', listener),
  };
  const spawner = (command: string, args: readonly string[]): HelperProcess => {
    state.command = command;
    state.args = [...args];
    return helperProcess;
  };
  const close = (code: number | null): boolean => closes.emit('close', code);
  const fail = (error: Error): boolean => closes.emit('error', error);
  return { stdout, stderr, state, spawner, close, fail };
}

function recordedEvents() {
  const log: string[] = [];
  const events: PcmEvents = {
    started: () => log.push('started'),
    data: (chunk) => log.push(`data ${[...chunk].join(',')}`),
    ended: (problem) => log.push(`ended ${problem}`),
  };
  return { events, log };
}

/** Lets the streams pass on what was written to them. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('wasapiLoopback', () => {
  it('runs the bundled C# helper through Windows PowerShell', () => {
    const helper = fakeHelper();

    wasapiLoopback(helper.spawner)(recordedEvents().events);

    assert.equal(helper.state.command, 'powershell.exe');
    assert.match(helper.state.args.at(-1) ?? '', /Add-Type -Path '.*wasapi-loopback\.cs'/);
    assert.deepEqual(helper.state.args, HELPER_ARGS);
  });

  it('says it started when the helper does, then passes its sound on', async () => {
    const helper = fakeHelper();
    const { events, log } = recordedEvents();
    wasapiLoopback(helper.spawner)(events);

    helper.stderr.write('capturing\r\n');
    await settle();
    helper.stdout.write(new Uint8Array([7, 8]));
    await settle();

    assert.deepEqual(log, ['started', 'data 7,8']);
  });

  it('ends with what the helper complained of when it fails', async () => {
    const helper = fakeHelper();
    const { events, log } = recordedEvents();
    wasapiLoopback(helper.spawner)(events);

    helper.stderr.write('loopback unavailable: 0x88890004\r\n');
    await settle();
    helper.close(2);

    assert.deepEqual(log, ['ended loopback unavailable: 0x88890004']);
  });

  it('ends plainly when the helper finishes cleanly', () => {
    const helper = fakeHelper();
    const { events, log } = recordedEvents();
    wasapiLoopback(helper.spawner)(events);

    helper.close(0);

    assert.deepEqual(log, ['ended null']);
  });

  it('ends once, with the reason, when the helper cannot be started', () => {
    const helper = fakeHelper();
    const { events, log } = recordedEvents();
    wasapiLoopback(helper.spawner)(events);

    helper.fail(new Error('spawn powershell.exe ENOENT'));
    helper.close(null);

    assert.deepEqual(log, ['ended spawn powershell.exe ENOENT']);
  });

  it('stops the helper by closing its input and killing it, reporting no end', async () => {
    const helper = fakeHelper();
    const { events, log } = recordedEvents();
    const stop = wasapiLoopback(helper.spawner)(events);

    stop();
    await settle();
    helper.close(1);

    assert.ok(helper.state.isStdinClosed);
    assert.ok(helper.state.isKilled);
    assert.deepEqual(log, []);
  });
});
