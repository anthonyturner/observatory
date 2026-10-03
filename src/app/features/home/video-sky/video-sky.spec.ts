import { TestBed } from '@angular/core/testing';
import { PlaylistPlayer } from '../../../core/playlist/playlist-player';
import { VideoBackground } from '../../../core/playlist/video-background';
import { VideoSky } from './video-sky';

function render() {
  const attach = vi.fn();
  TestBed.configureTestingModule({
    providers: [{ provide: PlaylistPlayer, useValue: { attach } }],
  });
  const fixture = TestBed.createComponent(VideoSky);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  return { fixture, element, attach, background: TestBed.inject(VideoBackground) };
}

describe('VideoSky', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('leaves the player where it is while the switch is off', () => {
    const { attach } = render();
    expect(attach).not.toHaveBeenCalled();
  });

  it('takes the player once the switch is on', () => {
    const { fixture, element, attach, background } = render();
    background.toggle();
    fixture.detectChanges();
    expect(attach).toHaveBeenCalledWith(element.querySelector('.screen'));
  });

  it('keeps out of the way of the pointer, the keyboard and screen readers', () => {
    const { element } = render();
    expect(element.hasAttribute('inert')).toBe(true);
    expect(element.getAttribute('aria-hidden')).toBe('true');
  });
});
