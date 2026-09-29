import { TestBed } from '@angular/core/testing';
import { TRAIL_SPEEDS, TrailSpeed } from './trail-speed';

describe('TrailSpeed', () => {
  beforeEach(() => localStorage.clear());

  it('starts at the natural pace', () => {
    expect(TestBed.inject(TrailSpeed).multiplier()).toBe(1);
  });

  it('moves between the lever’s stops and remembers the choice', () => {
    TestBed.inject(TrailSpeed).set(TRAIL_SPEEDS.indexOf(25));
    TestBed.resetTestingModule();

    expect(TestBed.inject(TrailSpeed).multiplier()).toBe(25);
  });

  it('keeps to the lever’s ends', () => {
    const speed = TestBed.inject(TrailSpeed);
    speed.set(99);
    expect(speed.multiplier()).toBe(100);
    speed.set(-3);
    expect(speed.multiplier()).toBe(0);
  });

  it('falls back to the natural pace from a stored value it cannot read', () => {
    localStorage.setItem('observatory.trail-speed', 'fast');

    expect(TestBed.inject(TrailSpeed).multiplier()).toBe(1);
  });
});
