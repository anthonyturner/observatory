import { ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CoreMood } from '../instrument/core-mood';
import { CORE_MOOD } from '../instrument/core-tokens';
import { AmbientPlayer } from './ambient-synth';
import { AMBIENT_PLAYER, SoundPreference } from './sound-preference';

const KEY = 'observatory.sound';

class FakePlayer implements AmbientPlayer {
  starts = 0;
  stops = 0;
  unease: number | null = null;
  constructor(private readonly fails = false) {}
  start(): Promise<void> {
    this.starts++;
    return this.fails ? Promise.reject(new Error('no audio')) : Promise.resolve();
  }
  stop(): void {
    this.stops++;
  }
  dispose(): void {
    this.stops++;
  }
  setUnease(level: number): void {
    this.unease = level;
  }
}

const CALM: CoreMood = { name: 'calm', stress: 0, reason: 'nothing blocked' };

function setup(player = new FakePlayer(), mood = signal<CoreMood>(CALM)) {
  const errors: unknown[] = [];
  TestBed.configureTestingModule({
    providers: [
      { provide: CORE_MOOD, useValue: mood },
      { provide: AMBIENT_PLAYER, useValue: () => player },
      { provide: ErrorHandler, useValue: { handleError: (e: unknown) => errors.push(e) } },
    ],
  });
  return { sound: TestBed.inject(SoundPreference), player, errors, mood };
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

  it('tells the player how uneasy to sound, and follows the mood as it changes', () => {
    const { sound, player, mood } = setup();
    sound.toggle();
    expect(player.unease).toBe(0);
    mood.set({ name: 'strained', stress: 0.8, reason: '' });
    TestBed.tick();
    expect(player.unease).toBe(0.8);
  });
});
