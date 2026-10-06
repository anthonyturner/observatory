import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MusicPulse } from './music-pulse';
import { SILENCE } from './music-sync.types';
import { CaptureUnsupportedError, NoAudioError } from './sources/audio-tap';
import { SoundSourceChoice } from './sources/sound-source-choice';
import { SOUND_SOURCES } from './sources/sound-sources';
import { FakeSoundSource, FakeTap } from './sources/testing/fake-sound-source';

/** A tab source answering with `open`, and a computer source, both on offer
 *  unless `canShare` is false, as on a phone. */
function setup(open: () => Promise<FakeTap>, { canShare = true } = {}) {
  const errors: unknown[] = [];
  const tab = new FakeSoundSource('tab');
  const computer = new FakeSoundSource('computer');
  tab.answer = open;
  if (!canShare) [tab, computer].forEach((source) => source.options.set([]));
  TestBed.configureTestingModule({
    providers: [
      MusicPulse,
      { provide: SOUND_SOURCES, useValue: [tab, computer] },
      { provide: ErrorHandler, useValue: { handleError: (e: unknown) => errors.push(e) } },
    ],
  });
  return { pulse: TestBed.inject(MusicPulse), tab, computer, errors };
}

const settle = (): Promise<void> => new Promise((done) => setTimeout(done));

describe('MusicPulse', () => {
  beforeEach(() => localStorage.clear());

  it('never asks on its own where the browser can use no source', () => {
    const { pulse, tab } = setup(() => Promise.resolve(new FakeTap()), { canShare: false });
    expect(pulse.canListen()).toBe(false);

    pulse.listenOnce();
    pulse.listen();
    expect(tab.opened).toEqual([]);
    expect(pulse.status()).toBe('off');
  });

  it('listens once a visit from listenOnce, and hears the chosen source', async () => {
    const tap = new FakeTap();
    const { pulse, tab } = setup(() => Promise.resolve(tap));
    expect(pulse.sample(0)).toBe(SILENCE);

    pulse.listenOnce();
    expect(pulse.isAsking()).toBe(true);
    await settle();
    expect(pulse.isListening()).toBe(true);
    expect(pulse.sample(0).bass).toBeGreaterThan(0.7);

    pulse.stop();
    pulse.listenOnce();
    expect(tab.opened).toEqual(['tab']);
    expect(tap.closed).toBe(true);
    expect(pulse.status()).toBe('off');
  });

  it('asks again from listen after a stop', async () => {
    const { pulse, tab } = setup(() => Promise.resolve(new FakeTap()));
    pulse.listen();
    await settle();
    pulse.stop();
    pulse.listen();
    await settle();
    expect(tab.opened.length).toBe(2);
    expect(pulse.isListening()).toBe(true);
  });

  it('opens the source picked in the chooser', async () => {
    const { pulse, tab, computer } = setup(() => Promise.resolve(new FakeTap()));
    TestBed.inject(SoundSourceChoice).choose('computer');
    pulse.listen();
    await settle();
    expect(computer.opened).toEqual(['computer']);
    expect(tab.opened).toEqual([]);
  });

  it('switches a listening sky to the newly picked source at once', async () => {
    const first = new FakeTap();
    const { pulse, computer } = setup(() => Promise.resolve(first));
    pulse.listen();
    await settle();

    pulse.switchTo('computer');
    expect(first.closed).toBe(true);
    expect(computer.opened).toEqual(['computer']);
    await settle();
    expect(pulse.isListening()).toBe(true);
  });

  it('only remembers a source picked while not listening, clearing a stale failure', async () => {
    const { pulse, computer } = setup(() => Promise.reject(new NoAudioError()));
    pulse.listen();
    await settle();
    expect(pulse.status()).toBe('no-audio');

    pulse.switchTo('computer');
    expect(pulse.status()).toBe('off');
    expect(computer.opened).toEqual([]);
    expect(TestBed.inject(SoundSourceChoice).selected()?.option.id).toBe('computer');
  });

  it('lends out the sound while listening, and takes it back on a stop', async () => {
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
      { error: new NoAudioError(), status: 'no-audio' },
      { error: new CaptureUnsupportedError(), status: 'unsupported' },
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
