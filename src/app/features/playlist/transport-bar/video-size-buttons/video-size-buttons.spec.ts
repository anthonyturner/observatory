import { TestBed } from '@angular/core/testing';
import { VideoCardSize } from '../../../../core/playlist/video-card-size';
import { VideoSizeButtons } from './video-size-buttons';

function render() {
  const fixture = TestBed.createComponent(VideoSizeButtons);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    element.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  return { fixture, element, button, size: TestBed.inject(VideoCardSize) };
}

describe('VideoSizeButtons', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('is a group a screen reader names Video size', () => {
    const { element } = render();
    expect(element.getAttribute('role')).toBe('group');
    expect(element.getAttribute('aria-label')).toBe('Video size');
  });

  it('presses the button for the size chosen, and only that one', () => {
    const { fixture, button, size } = render();
    expect(button('Smaller video')?.getAttribute('aria-pressed')).toBe('false');
    expect(button('Bigger video')?.getAttribute('aria-pressed')).toBe('false');

    button('Smaller video')?.click();
    fixture.detectChanges();
    expect(size.current()).toBe('smaller');
    expect(button('Smaller video')?.getAttribute('aria-pressed')).toBe('true');
    expect(button('Bigger video')?.getAttribute('aria-pressed')).toBe('false');

    button('Bigger video')?.click();
    fixture.detectChanges();
    expect(size.current()).toBe('larger');
    expect(button('Smaller video')?.getAttribute('aria-pressed')).toBe('false');
    expect(button('Bigger video')?.getAttribute('aria-pressed')).toBe('true');
  });
});
