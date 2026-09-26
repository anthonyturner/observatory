import { TestBed } from '@angular/core/testing';
import { StarmapScore, gainFor, tensionGainFor } from './starmap-score';
import { STARMAP_SCORE, StarmapSound } from './starmap-sound';

function fakeScore() {
  const calls: string[] = [];
  const score: StarmapScore = {
    start: async () => void calls.push('start'),
    stop: () => void calls.push('stop'),
    setTension: (n) => void calls.push(`tension ${n}`),
    setVolume: (v) => void calls.push(`volume ${v}`),
    ping: (stuck, pr) => void calls.push(`ping ${stuck} ${pr}`),
  };
  return { score, calls };
}

function setUp() {
  const { score, calls } = fakeScore();
  TestBed.configureTestingModule({
    providers: [{ provide: STARMAP_SCORE, useValue: () => score }],
  });
  return { sound: TestBed.inject(StarmapSound), calls };
}

describe('StarmapSound', () => {
  beforeEach(() => localStorage.clear());

  it('is off until asked for, then plays at the remembered volume and tension', () => {
    const { sound, calls } = setUp();
    sound.setTension(3);
    expect(sound.isOn()).toBe(false);

    sound.toggle();

    expect(sound.isOn()).toBe(true);
    expect(calls).toEqual(['volume 0.7', 'tension 3', 'start']);
    expect(localStorage.getItem('observatory.starmap.sound')).toBe('on');
  });

  it('pings a chosen star only while it plays', () => {
    const { sound, calls } = setUp();
    sound.ping(true, 58);
    sound.toggle();
    sound.ping(false, 195);

    expect(calls.filter((c) => c.startsWith('ping'))).toEqual(['ping false 195']);
  });

  it('remembers the volume and fades out when turned off', () => {
    const { sound, calls } = setUp();
    sound.toggle();
    sound.setVolume(0.3);
    sound.toggle();

    expect(localStorage.getItem('observatory.starmap.volume')).toBe('0.3');
    expect(calls.slice(-2)).toEqual(['volume 0.3', 'stop']);
  });
});

describe('the score’s curves', () => {
  it('follows the slider’s square, and tops the tension out at twelve blocked', () => {
    expect(gainFor(0.5)).toBeCloseTo(0.6);
    expect(tensionGainFor(0)).toBe(0);
    expect(tensionGainFor(6)).toBeCloseTo(0.0225);
    expect(tensionGainFor(40)).toBeCloseTo(0.045);
  });
});
