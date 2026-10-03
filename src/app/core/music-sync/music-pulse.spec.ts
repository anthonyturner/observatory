import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MusicPulse } from './music-pulse';
import { SILENCE } from './music-sync.types';
import { AUDIO_TAP, AudioTap, NoTabAudioError, TabAudioUnsupportedError } from './tab-audio';

class FakeTap implements AudioTap {
  readonly binHz = 20;
  readonly binCount = 1024;
  closed = false;
  ended: (() => void) | null = null;
  read(into: Uint8Array<ArrayBuffer>): void {
    into.fill(200);
  }
  onEnded(callback: () => void): void {
    this.ended = callback;
  }
  close(): void {
    this.closed = true;
  }
}

function setup(open: () => Promise<AudioTap>) {
  const errors: unknown[] = [];
  const opener = vi.fn(open);
  TestBed.configureTestingModule({
    providers: [
      MusicPulse,
      { provide: AUDIO_TAP, useValue: opener },
      { provide: ErrorHandler, useValue: { handleError: (e: unknown) => errors.push(e) } },
    ],
  });
  return { pulse: TestBed.inject(MusicPulse), opener, errors };
}

const settle = (): Promise<void> => new Promise((done) => setTimeout(done));

describe('MusicPulse', () => {
  it('listens once a visit from listenOnce, and hears the tab', async () => {
    const tap = new FakeTap();
    const { pulse, opener } = setup(() => Promise.resolve(tap));
    expect(pulse.sample(0)).toBe(SILENCE);

    pulse.listenOnce();
    expect(pulse.status()).toBe('asking');
    await settle();
    expect(pulse.isListening()).toBe(true);
    expect(pulse.sample(0).bass).toBeGreaterThan(0.7);

    pulse.stop();
    pulse.listenOnce();
    expect(opener).toHaveBeenCalledTimes(1);
    expect(tap.closed).toBe(true);
    expect(pulse.status()).toBe('off');
  });

  it('asks again from listen after a stop', async () => {
    const { pulse, opener } = setup(() => Promise.resolve(new FakeTap()));
    pulse.listen();
    await settle();
    pulse.stop();
    pulse.listen();
    await settle();
    expect(opener).toHaveBeenCalledTimes(2);
    expect(pulse.isListening()).toBe(true);
  });

  it('lends out the tab sound while listening, and takes it back on a stop', async () => {
    const sound = { context: {} as AudioContext, source: {} as AudioNode };
    const { pulse } = setup(() => Promise.resolve(Object.assign(new FakeTap(), { sound })));
    expect(pulse.sound()).toBeNull();
    pulse.listen();
    await settle();
    expect(pulse.sound()).toBe(sound);
    pulse.stop();
    expect(pulse.sound()).toBeNull();
  });

  it('goes quiet when sharing is stopped from the browser', async () => {
    const tap = new FakeTap();
    const { pulse } = setup(() => Promise.resolve(tap));
    pulse.listen();
    await settle();
    tap.ended?.();
    expect(pulse.status()).toBe('off');
    expect(pulse.sample(1)).toBe(SILENCE);
  });

  it('says why it is not listening', async () => {
    const cases = [
      { error: new NoTabAudioError(), status: 'no-audio' },
      { error: new TabAudioUnsupportedError(), status: 'unsupported' },
      { error: new DOMException('no', 'NotAllowedError'), status: 'denied' },
    ] as const;
    for (const { error, status } of cases) {
      TestBed.resetTestingModule();
      const { pulse, errors } = setup(() => Promise.reject(error));
      pulse.listen();
      await settle();
      expect(pulse.status()).toBe(status);
      expect(errors).toEqual([]);
    }
  });

  it('reports a failure it does not expect, and stays off', async () => {
    const { pulse, errors } = setup(() => Promise.reject(new Error('audio broke')));
    pulse.listen();
    await settle();
    expect(pulse.status()).toBe('off');
    expect(errors.length).toBe(1);
  });

  it('stops listening when the page goes', async () => {
    const tap = new FakeTap();
    const { pulse } = setup(() => Promise.resolve(tap));
    pulse.listen();
    await settle();
    TestBed.resetTestingModule();
    expect(tap.closed).toBe(true);
  });
});
