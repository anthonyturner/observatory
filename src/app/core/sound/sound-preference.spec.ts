import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AmbientPlayer } from './ambient-synth';
import { AMBIENT_PLAYER, SoundPreference } from './sound-preference';

const KEY = 'observatory.sound';

class FakePlayer implements AmbientPlayer {
  starts = 0;
  stops = 0;
  constructor(private readonly fails = false) {}
  start(): Promise<void> {
    this.starts++;
    return this.fails ? Promise.reject(new Error('no audio')) : Promise.resolve();
  }
  stop(): void {
    this.stops++;
  }
}

function setup(player = new FakePlayer()) {
  const errors: unknown[] = [];
  TestBed.configureTestingModule({
    providers: [
      { provide: AMBIENT_PLAYER, useValue: () => player },
      { provide: ErrorHandler, useValue: { handleError: (e: unknown) => errors.push(e) } },
    ],
  });
  return { sound: TestBed.inject(SoundPreference), player, errors };
}

describe('SoundPreference', () => {
  beforeEach(() => localStorage.clear());

  it('starts off and plays nothing', () => {
    const { sound, player } = setup();
    expect(sound.isOn()).toBe(false);
    expect(player.starts).toBe(0);
  });

  it('plays on the first press, fades out on the next, and remembers', () => {
    const { sound, player } = setup();
    sound.toggle();
    expect(sound.isOn()).toBe(true);
    expect(player.starts).toBe(1);
    expect(localStorage.getItem(KEY)).toBe('on');
    sound.toggle();
    expect(player.stops).toBe(1);
    expect(localStorage.getItem(KEY)).toBe('off');
  });

  it('comes back on at the first touch of the page when left on', () => {
    localStorage.setItem(KEY, 'on');
    const { sound, player } = setup();
    expect(sound.isOn()).toBe(true);
    expect(player.starts).toBe(0);
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('keydown'));
    expect(player.starts).toBe(1);
  });

  it('reports audio that will not start', async () => {
    const { sound, errors } = setup(new FakePlayer(true));
    sound.toggle();
    await Promise.resolve();
    await Promise.resolve();
    expect(errors).toHaveLength(1);
  });
});
