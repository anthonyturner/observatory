import { TestBed } from '@angular/core/testing';
import { SpeakPreference } from './speak-preference';

const KEY = 'observatory.speak';

describe('SpeakPreference', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('starts off, then remembers each choice in this browser', () => {
    const speak = TestBed.inject(SpeakPreference);
    expect(speak.isOn()).toBe(false);
    speak.turnOn();
    expect(speak.isOn()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('on');
    speak.turnOff();
    expect(localStorage.getItem(KEY)).toBe('off');
  });

  it('starts on when left on', () => {
    localStorage.setItem(KEY, 'on');
    expect(TestBed.inject(SpeakPreference).isOn()).toBe(true);
  });

  it('goes off for this visit without forgetting the choice', () => {
    localStorage.setItem(KEY, 'on');
    const speak = TestBed.inject(SpeakPreference);
    speak.turnOffForVisit();
    expect(speak.isOn()).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('on');
  });

  it('still works where storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const speak = TestBed.inject(SpeakPreference);
    expect(speak.isOn()).toBe(false);
    speak.turnOn();
    expect(speak.isOn()).toBe(true);
  });
});
