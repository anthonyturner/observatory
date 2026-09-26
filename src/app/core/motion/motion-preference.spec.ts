import { TestBed } from '@angular/core/testing';
import { MotionPreference } from './motion-preference';

const KEY = 'observatory.motion';

function stubReducedMotion(reduced: boolean): void {
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('MotionPreference', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('follows the system until overridden', () => {
    stubReducedMotion(true);
    const motion = TestBed.inject(MotionPreference);
    expect(motion.choice()).toBe('auto');
    expect(motion.isStill()).toBe(true);
  });

  it('turns motion on over a still system, and remembers it', () => {
    stubReducedMotion(true);
    const motion = TestBed.inject(MotionPreference);
    motion.toggle();
    expect(motion.isStill()).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('on');
  });

  it('turns motion off when the page moves', () => {
    stubReducedMotion(false);
    const motion = TestBed.inject(MotionPreference);
    motion.toggle();
    expect(motion.isStill()).toBe(true);
    expect(motion.choice()).toBe('off');
  });

  it('starts from a remembered choice', () => {
    localStorage.setItem(KEY, 'on');
    stubReducedMotion(true);
    expect(TestBed.inject(MotionPreference).isStill()).toBe(false);
  });

  it('still toggles when storage is blocked', () => {
    stubReducedMotion(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const motion = TestBed.inject(MotionPreference);
    motion.toggle();
    expect(motion.isStill()).toBe(false);
  });
});
