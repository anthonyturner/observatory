import { TestBed } from '@angular/core/testing';
import { MilkdropOpacity } from '../../../core/music-sync/milkdrop/milkdrop-opacity';
import { AmbientPlayer } from '../../../core/sound/ambient-synth';
import { AMBIENT_PLAYER, SoundPreference } from '../../../core/sound/sound-preference';
import {
  VIDEO_PLAYER_FACTORY,
  VideoPlayer,
  VideoPlayerOptions,
} from '../../../core/playlist/video-player';
import { PLAYLIST_TRACKS, PlaylistPlayer } from '../../../core/playlist/playlist-player';
import { PlaylistLibrary } from '../../../core/playlist/playlist-library';
import { FavoritesStore } from '../../../core/playlist/favorites-store';
import { MilkdropChoice } from '../../../core/music-sync/milkdrop/milkdrop-choice';
import { CURATED_PRESETS } from '../../../core/music-sync/milkdrop/milkdrop-presets';
import { MusicPulse } from '../../../core/music-sync/music-pulse';
import { AUDIO_TAP, AudioTap } from '../../../core/music-sync/tab-audio';
import { FILE_SAVER, FileSaver } from '../../../core/files/file-saver';
import { VideoBackground } from '../../../core/playlist/video-background';
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
    seekTo: vi.fn(),
    currentTime: () => 0,
    duration: () => 0,
    dispose: vi.fn(),
  };
  const make = vi.fn<(options: VideoPlayerOptions) => Promise<VideoPlayer>>(() =>
    Promise.resolve(player),
  );
  const tap: AudioTap = {
    binHz: 20,
    binCount: 8,
    read: vi.fn(),
    onEnded: vi.fn(),
    close: vi.fn(),
  };
  const openTap = vi.fn(() => Promise.resolve(tap));
  const saver: FileSaver = { save: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      PlaylistPlayer,
      PlaylistLibrary,
      MusicPulse,
      { provide: AUDIO_TAP, useValue: openTap },
      { provide: VIDEO_PLAYER_FACTORY, useValue: make },
      { provide: AMBIENT_PLAYER, useValue: () => silentScore },
      { provide: FILE_SAVER, useValue: saver },
    ],
  });
  const fixture = TestBed.createComponent(TransportBar);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
    );
  const sound = TestBed.inject(SoundPreference);
  return {
    fixture,
    element,
    button,
    make,
    pauses,
    sound,
    openTap,
    saver,
    pulse: TestBed.inject(MusicPulse),
    favorites: TestBed.inject(FavoritesStore),
    player,
    tracks: TestBed.inject(PLAYLIST_TRACKS),
  };
}

describe('TransportBar', () => {
  beforeEach(() => localStorage.clear());

  it('shows the first track before anything plays, and loads nothing', () => {
    const { element, make, tracks } = render();
    expect(element.textContent).toContain(tracks[0].title);
    expect(element.textContent).toContain(`1 / ${tracks.length}`);
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

  it('sets how strongly Milkdrop shows from its slider', () => {
    const { fixture, element } = render();
    const slider = element.querySelector<HTMLInputElement>(
      'input[aria-label="Milkdrop visuals opacity"]',
    );
    expect(Number(slider?.value)).toBe(TestBed.inject(MilkdropOpacity).level());
    if (slider) slider.value = '0.25';
    slider?.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(TestBed.inject(MilkdropOpacity).level()).toBe(0.25);
  });

  it('keeps the video in its card on a page with no backdrop to fill', async () => {
    const { fixture, element, button } = render();
    button('Play')?.click();
    await fixture.whenStable();
    button('Video')?.click();
    fixture.detectChanges();
    expect(button('Video')?.getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('.card--live')).not.toBeNull();
  });

  it('moves the video behind the page from the Video switch, and back', async () => {
    const { fixture, element, button, make } = render();
    TestBed.inject(VideoBackground).holdBackdrop();
    button('Play')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('.card--live')).not.toBeNull();

    const video = button('Video');
    video?.click();
    fixture.detectChanges();
    expect(video?.getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('.card--live')).toBeNull();
    expect(
      element.querySelector<HTMLInputElement>('input[aria-label="Milkdrop visuals opacity"]')
        ?.disabled,
    ).toBe(true);
    expect(
      element.querySelector<HTMLSelectElement>('select[aria-label="Milkdrop visual"]')?.disabled,
    ).toBe(true);

    video?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(video?.getAttribute('aria-pressed')).toBe('false');
    expect(element.querySelector('.card--live')).not.toBeNull();
    expect(make.mock.calls.at(-1)?.[0].host).toBe(element.querySelector('.screen'));
  });

  it('opens the track list and plays the one picked', async () => {
    const { fixture, element, button, tracks } = render();
    const tracksButton = button('Tracks');
    tracksButton?.click();
    fixture.detectChanges();
    expect(tracksButton?.getAttribute('aria-expanded')).toBe('true');

    const picks = element.querySelectorAll<HTMLButtonElement>('app-track-list .pick');
    expect(picks.length).toBe(tracks.length);
    picks[2].click();
    fixture.detectChanges();
    expect(element.querySelector('app-track-list')).toBeNull();
    expect(element.textContent).toContain(tracks[2].title);
  });

  it('asks to hear the tab on the first Play of a visit, and only then', async () => {
    const { fixture, button, openTap } = render();
    button('Play')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(openTap).toHaveBeenCalledTimes(1);
    expect(button('Synced')?.getAttribute('aria-pressed')).toBe('true');

    button('Synced')?.click();
    fixture.detectChanges();
    button('Play')?.click();
    expect(openTap).toHaveBeenCalledTimes(1);
  });

  it('asks again from Sync after sharing was declined', async () => {
    const { fixture, button, openTap } = render();
    openTap.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'));
    button('Sync')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button('Sync')?.title).toContain('declined');

    button('Sync')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(openTap).toHaveBeenCalledTimes(2);
    expect(button('Synced')).toBeDefined();
  });

  it('hearts the track playing, and the Favourites switch then plays the hearted ones', () => {
    const { fixture, element, button, favorites, tracks } = render();
    const heart = button('Favourite');
    const favoritesButton = (): HTMLButtonElement | null =>
      element.querySelector('.source button:last-child');
    expect(favoritesButton()?.disabled).toBe(true);

    heart?.click();
    fixture.detectChanges();
    expect(heart?.getAttribute('aria-pressed')).toBe('true');
    expect(favorites.tracks()).toEqual([tracks[0]]);
    expect(favoritesButton()?.textContent).toContain('1');

    favoritesButton()?.click();
    fixture.detectChanges();
    expect(favoritesButton()?.getAttribute('aria-pressed')).toBe('true');
    expect(element.textContent).toContain('1 / 1');
  });

  it('hearts a track from its row in the track list', () => {
    const { fixture, element, button, favorites, tracks } = render();
    button('Tracks')?.click();
    fixture.detectChanges();
    element.querySelectorAll<HTMLButtonElement>('app-track-list .heart')[3].click();
    fixture.detectChanges();
    expect(favorites.has(tracks[3].videoId)).toBe(true);
  });

  it('offers Export once a track is hearted, and says why it cannot before then', () => {
    const { fixture, element, button, saver } = render();
    const exportButton = button('Export favourites');
    expect(exportButton?.getAttribute('aria-disabled')).toBe('true');
    expect(exportButton?.title).toContain('No favourites to export yet');

    exportButton?.click();
    fixture.detectChanges();
    expect(saver.save).not.toHaveBeenCalled();
    expect(element.querySelector('.notice[aria-live="polite"]')?.textContent).toContain(
      'No favourites to export yet',
    );

    button('Favourite')?.click();
    fixture.detectChanges();
    expect(exportButton?.hasAttribute('aria-disabled')).toBe(false);
    exportButton?.click();
    fixture.detectChanges();
    expect(saver.save).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.notice')?.textContent).toContain('Exported 1 favourite');
  });

  it('imports favourites from the file picked, and announces the count', async () => {
    const { fixture, element, button, favorites, tracks } = render();
    const picker = element.querySelector<HTMLInputElement>('.transfer input[type="file"]');
    if (!picker) throw new Error('no file picker');
    expect(picker.accept).toBe('.json,application/json');
    const opens = vi.spyOn(picker, 'click').mockImplementation(() => undefined);
    button('Import favourites')?.click();
    expect(opens).toHaveBeenCalled();

    const text = JSON.stringify({
      format: 'observatory.favorites',
      version: 1,
      tracks: [tracks[4]],
    });
    Object.defineProperty(picker, 'files', { value: [new File([text], 'favourites.json')] });
    picker.dispatchEvent(new Event('change'));

    await vi.waitFor(() => expect(favorites.tracks()).toEqual([tracks[4]]));
    fixture.detectChanges();
    expect(element.querySelector('.notice')?.textContent).toContain('Added 1 favourite');
  });

  it('keeps the seek bar off until the track has a length, showing no time yet', () => {
    const { element } = render();
    const seek = element.querySelector<HTMLInputElement>('input[aria-label="Position in track"]');
    expect(seek?.disabled).toBe(true);
    expect(element.querySelector('.scrub')?.textContent).toContain('--:--');
  });

  it('holds the dragged position, then seeks there on release', async () => {
    const { fixture, element, button, player, make } = render();
    player.duration = () => 300;
    player.currentTime = () => 10;
    button('Play')?.click();
    await fixture.whenStable();
    vi.useFakeTimers();
    try {
      make.mock.calls[0][0].events.playing();
      fixture.detectChanges();
      const seek = element.querySelector<HTMLInputElement>('input[aria-label="Position in track"]');
      if (!seek) throw new Error('no seek bar');
      expect(seek.disabled).toBe(false);
      expect(element.querySelector('.scrub')?.textContent).toContain('5:00');

      seek.value = '200';
      seek.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();
      expect(element.querySelector('.scrub')?.textContent).toContain('3:20');
      expect(player.seekTo).not.toHaveBeenCalled();

      seek.dispatchEvent(new Event('change'));
      expect(player.seekTo).toHaveBeenCalledWith(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it('picks the Milkdrop visual, starting on Auto and going back to it', () => {
    const { fixture, element } = render();
    const choice = TestBed.inject(MilkdropChoice);
    const select = element.querySelector<HTMLSelectElement>('select[aria-label="Milkdrop visual"]');
    expect(select?.options[0].textContent?.trim()).toBe('Auto');
    expect(select?.options.length).toBe(CURATED_PRESETS.length + 1);
    expect(select?.value).toBe('');

    if (select) select.value = CURATED_PRESETS[4];
    select?.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(choice.preset()).toBe(CURATED_PRESETS[4]);

    if (select) select.value = '';
    select?.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(choice.preset()).toBeNull();
  });

  it('groups the list controls apart from the sky controls, after the volume', () => {
    const { element } = render();
    const group = (label: string) =>
      element.querySelector<HTMLElement>(`.extras > [role="group"][aria-label="${label}"]`);
    const list = group('List');
    const sky = group('Sky');

    expect(list?.textContent).toContain('Mix');
    expect(list?.textContent).toContain('Tracks');
    expect(list?.querySelector('[aria-label="Export favourites"]')).not.toBeNull();
    expect(sky?.textContent).toContain('Video');
    expect(sky?.textContent).toContain('Sync');
    expect(sky?.querySelector('select[aria-label="Milkdrop visual"]')).not.toBeNull();
    expect(sky?.querySelector('input[aria-label="Milkdrop visuals opacity"]')).not.toBeNull();
    expect([...(element.querySelector('.extras')?.children ?? [])]).toEqual([
      element.querySelector('.volume'),
      list,
      sky,
    ]);
  });

  it('folds down to the seek bar, the transport, the heart and the name, and back', () => {
    const { fixture, element, button } = render();
    const fold = button('More playlist controls');
    expect(fold?.getAttribute('aria-expanded')).toBe('true');
    button('Tracks')?.click();
    fixture.detectChanges();

    fold?.click();
    fixture.detectChanges();
    expect(fold?.getAttribute('aria-expanded')).toBe('false');
    expect(element.classList).toContain('folded');
    for (const hidden of ['Tracks', 'Mix', 'Export favourites', 'Video']) {
      expect(button(hidden)).toBeUndefined();
    }
    expect(element.querySelector('select[aria-label="Milkdrop visual"]')).toBeNull();
    expect(element.querySelector('input[aria-label="Playlist volume"]')).toBeNull();
    expect(element.querySelector('app-track-list')).toBeNull();
    for (const kept of ['Play', 'Previous track', 'Next track', 'Favourite', 'Back 15 seconds']) {
      expect(button(kept)).toBeDefined();
    }
    expect(element.querySelector('.now__title')).not.toBeNull();

    fold?.click();
    fixture.detectChanges();
    expect(element.classList).not.toContain('folded');
    expect(button('Tracks')).toBeDefined();
  });

  it('offers a bigger video once the card shows, and back again', async () => {
    const { fixture, element, button } = render();
    expect(button('Bigger video')).toBeUndefined();
    button('Play')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const enlarge = button('Bigger video');
    expect(enlarge?.getAttribute('aria-pressed')).toBe('false');
    enlarge?.click();
    fixture.detectChanges();
    expect(enlarge?.getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('.card')?.classList).toContain('card--large');

    enlarge?.click();
    fixture.detectChanges();
    expect(element.querySelector('.card')?.classList).not.toContain('card--large');
  });
});
