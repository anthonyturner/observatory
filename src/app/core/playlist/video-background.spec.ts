import { TestBed } from '@angular/core/testing';
import { VideoBackground } from './video-background';

const STORAGE_KEY = 'observatory.music.video-background';

describe('VideoBackground', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('starts off', () => {
    expect(TestBed.inject(VideoBackground).isOn()).toBe(false);
  });

  it('turns on and off', () => {
    const background = TestBed.inject(VideoBackground);
    background.toggle();
    expect(background.isOn()).toBe(true);
    background.toggle();
    expect(background.isOn()).toBe(false);
  });

  it('keeps the choice between visits', () => {
    TestBed.inject(VideoBackground).toggle();
    TestBed.resetTestingModule();
    expect(TestBed.inject(VideoBackground).isOn()).toBe(true);
  });

  it('reads nonsense in storage as off', () => {
    localStorage.setItem(STORAGE_KEY, 'loud');
    expect(TestBed.inject(VideoBackground).isOn()).toBe(false);
  });
});
