import { TestBed } from '@angular/core/testing';
import { VideoCardSize } from './video-card-size';

const STORAGE_KEY = 'observatory.playlist.video-size';

describe('VideoCardSize', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('starts at the usual size', () => {
    const size = TestBed.inject(VideoCardSize);
    expect(size.current()).toBe('usual');
    expect(size.isSmaller()).toBe(false);
    expect(size.isLarger()).toBe(false);
  });

  it('turns smaller, and back to the usual size', () => {
    const size = TestBed.inject(VideoCardSize);
    size.toggleSmaller();
    expect(size.isSmaller()).toBe(true);
    size.toggleSmaller();
    expect(size.current()).toBe('usual');
  });

  it('turns larger, and back to the usual size', () => {
    const size = TestBed.inject(VideoCardSize);
    size.toggleLarger();
    expect(size.isLarger()).toBe(true);
    size.toggleLarger();
    expect(size.current()).toBe('usual');
  });

  it('lets only one of smaller and larger be on', () => {
    const size = TestBed.inject(VideoCardSize);
    size.toggleSmaller();
    size.toggleLarger();
    expect(size.isLarger()).toBe(true);
    expect(size.isSmaller()).toBe(false);
    size.toggleSmaller();
    expect(size.isSmaller()).toBe(true);
    expect(size.isLarger()).toBe(false);
  });

  it('keeps the choice between visits', () => {
    TestBed.inject(VideoCardSize).toggleSmaller();
    TestBed.resetTestingModule();
    expect(TestBed.inject(VideoCardSize).current()).toBe('smaller');
  });

  it('reads anything else in storage as the usual size', () => {
    localStorage.setItem(STORAGE_KEY, 'tiny');
    expect(TestBed.inject(VideoCardSize).current()).toBe('usual');
  });
});
