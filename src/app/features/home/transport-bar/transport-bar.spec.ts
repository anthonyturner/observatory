import { TestBed } from '@angular/core/testing';
import { AmbientPlayer } from '../../../core/sound/ambient-synth';
import { AMBIENT_PLAYER, SoundPreference } from '../../../core/sound/sound-preference';
import { VIDEO_PLAYER_FACTORY, VideoPlayer } from '../../../core/playlist/video-player';
import { TRANCE_PLAYLIST } from '../../../core/playlist/trance-playlist';
import { TransportBar } from './transport-bar';

const silentScore: AmbientPlayer = {
  start: () => Promise.resolve(),
  stop: () => undefined,
  dispose: () => undefined,
};

function render() {
  const pauses = vi.fn();
  const player: VideoPlayer = {
    load: vi.fn(),
    play: vi.fn(),
    pause: pauses,
    setVolume: vi.fn(),
    dispose: vi.fn(),
  };
  const make = vi.fn(() => Promise.resolve(player));
  TestBed.configureTestingModule({
    providers: [
      { provide: VIDEO_PLAYER_FACTORY, useValue: make },
      { provide: AMBIENT_PLAYER, useValue: () => silentScore },
    ],
  });
  const fixture = TestBed.createComponent(TransportBar);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
    );
  return { fixture, element, button, make, pauses, sound: TestBed.inject(SoundPreference) };
}

describe('TransportBar', () => {
  beforeEach(() => localStorage.clear());

  it('shows the first track before anything plays, and loads nothing', () => {
    const { element, make } = render();
    expect(element.textContent).toContain(TRANCE_PLAYLIST[0].title);
    expect(element.textContent).toContain(`1 / ${TRANCE_PLAYLIST.length}`);
    expect(make).not.toHaveBeenCalled();
  });

  it('turns the generated score off when the playlist starts', () => {
    const { button, make, sound } = render();
    sound.toggle();
    button('Play')?.click();
    expect(sound.isOn()).toBe(false);
    expect(make).toHaveBeenCalledTimes(1);
  });

  it('pauses the playlist when the score is turned on', async () => {
    const { fixture, button, pauses, sound } = render();
    button('Play')?.click();
    await fixture.whenStable();
    sound.toggle();
    TestBed.tick();
    expect(pauses).toHaveBeenCalled();
  });

  it('opens the track list and plays the one picked', async () => {
    const { fixture, element, button } = render();
    const tracks = button('Tracks');
    tracks?.click();
    fixture.detectChanges();
    expect(tracks?.getAttribute('aria-expanded')).toBe('true');

    const picks = element.querySelectorAll<HTMLButtonElement>('app-track-list button');
    expect(picks.length).toBe(TRANCE_PLAYLIST.length);
    picks[2].click();
    fixture.detectChanges();
    expect(element.querySelector('app-track-list')).toBeNull();
    expect(element.textContent).toContain(TRANCE_PLAYLIST[2].title);
  });
});
