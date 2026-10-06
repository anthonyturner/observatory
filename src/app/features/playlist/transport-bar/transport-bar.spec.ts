import { TestBed } from '@angular/core/testing';
import { BeatStrength } from '../../../core/music-sync/beat-strength';
import { MilkdropOpacity } from '../../../core/music-sync/milkdrop/milkdrop-opacity';
import { MusicSkyPresence } from '../../../core/music-sync/music-sky-presence';
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
import { AudioTap, NoAudioError } from '../../../core/music-sync/sources/audio-tap';
import { SOUND_SOURCES } from '../../../core/music-sync/sources/sound-sources';
import { FakeSoundSource } from '../../../core/music-sync/sources/testing/fake-sound-source';
import { FILE_SAVER, FileSaver } from '../../../core/files/file-saver';
import { VideoBackground } from '../../../core/playlist/video-background';
import { TransportBar } from './transport-bar';

const silentScore: AmbientPlayer = {
  start: () => Promise.resolve(),
  stop: () => undefined,
  dispose: () => undefined,
};

/** On Home by default: a page with a music sky, which the sky's controls need, in a
 *  browser that can share a tab's audio and the whole computer's; `onPhone`, it
 *  can share neither and hears its microphone instead. */
function render({ hasSky = true, canShare = true, hasComputer = true, onPhone = false } = {}) {
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
  const isSharing = canShare && !onPhone;
  const tabSource = new FakeSoundSource('tab', isSharing ? [{ id: 'tab', label: 'This tab' }] : []);
  const computerSource = new FakeSoundSource(
    'computer',
    isSharing && hasComputer ? [{ id: 'computer', label: 'Whole computer' }] : [],
  );
  const microphoneSource = new FakeSoundSource(
    'microphone',
    onPhone ? [{ id: 'microphone', label: 'Microphone' }] : [],
  );
  microphoneSource.opensWithPlay = false;
  tabSource.answer = openTap;
  const saver: FileSaver = { save: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      PlaylistPlayer,
      PlaylistLibrary,
      MusicPulse,
      { provide: SOUND_SOURCES, useValue: [tabSource, computerSource, microphoneSource] },
      { provide: VIDEO_PLAYER_FACTORY, useValue: make },
      { provide: AMBIENT_PLAYER, useValue: () => silentScore },
      { provide: FILE_SAVER, useValue: saver },
    ],
  });
  const leaveSky = hasSky ? TestBed.inject(MusicSkyPresence).hold() : () => undefined;
  const fixture = TestBed.createComponent(TransportBar);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
    );
  const sound = TestBed.inject(SoundPreference);
  const sourcePicker = () =>
    element.querySelector<HTMLSelectElement>('select[aria-label="Sync sound source"]');
  const pickSource = (id: string): void => {
    const picker = sourcePicker();
    if (!picker) throw new Error('No sound source picker');
    picker.value = id;
    picker.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  return {
    fixture,
    element,
    button,
    leaveSky,
    make,
    pauses,
    sound,
    openTap,
    computerSource,
    microphoneSource,
    sourcePicker,
    pickSource,
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

  it('sets how hard each beat hits from its slider', () => {
    const { fixture, element } = render();
    const strength = TestBed.inject(BeatStrength);
    const before = strength.level();
    try {
      const slider = element.querySelector<HTMLInputElement>('input[aria-label="Beat strength"]');
      expect(Number(slider?.value)).toBe(before);
      if (slider) slider.value = '0.35';
      slider?.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(strength.level()).toBe(0.35);
    } finally {
      strength.set(before);
    }
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

  it('shows no Sync or Beat and never asks where the browser can hear no source', async () => {
    const { fixture, element, button, openTap } = render({ canShare: false });
    expect(element.querySelector('.sync')).toBeNull();
    expect(element.querySelector('input[aria-label="Beat strength"]')).toBeNull();

    button('Play')?.click();
    await fixture.whenStable();
    expect(openTap).not.toHaveBeenCalled();
  });

  it('shows Sync and Beat on a phone, hearing its microphone from Sync and never from Play', async () => {
    const { fixture, element, button, microphoneSource, sourcePicker } = render({ onPhone: true });
    expect(element.querySelector('input[aria-label="Beat strength"]')).not.toBeNull();
    expect(sourcePicker()).toBeNull();
    expect(button('Sync')?.title).toContain(microphoneSource.guide.ask);

    button('Play')?.click();
    await fixture.whenStable();
    expect(microphoneSource.opened).toEqual([]);

    button('Sync')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(microphoneSource.opened).toEqual(['microphone']);
    expect(button('Synced')).toBeDefined();
  });

  it('offers This tab first and Whole computer beside Sync, and opens the one picked', async () => {
    const { fixture, button, openTap, computerSource, sourcePicker, pickSource } = render();
    const picker = sourcePicker();
    expect([...(picker?.options ?? [])].map((option) => option.textContent?.trim())).toEqual([
      'This tab',
      'Whole computer',
    ]);
    expect(picker?.value).toBe('tab');

    pickSource('computer');
    expect(button('Sync')?.title).toContain(computerSource.guide.ask);
    button('Sync')?.click();
    await fixture.whenStable();
    expect(computerSource.opened).toEqual(['computer']);
    expect(openTap).not.toHaveBeenCalled();
  });

  it('leaves the source picker out where only this tab can be heard', () => {
    const { element, sourcePicker } = render({ hasComputer: false });
    expect(sourcePicker()).toBeNull();
    expect(element.querySelector('.sync')).not.toBeNull();
  });

  it('names the chosen source’s audio box when the share came without sound', async () => {
    const { fixture, button, computerSource, pickSource } = render();
    computerSource.answer = () => Promise.reject(new NoAudioError());
    pickSource('computer');
    button('Sync')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button('No audio')?.title).toContain(computerSource.guide.silent);
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

    favoritesButton()?.click();
    fixture.detectChanges();
    expect(favoritesButton()?.getAttribute('aria-pressed')).toBe('false');
    expect(element.textContent).toContain(`1 / ${tracks.length}`);
  });

  it('tunes to the station picked, from the top of its list', () => {
    const { fixture, element } = render();
    const picker = element.querySelector<HTMLSelectElement>('select[aria-label="Station"]');
    const labels = [...(picker?.options ?? [])].map((option) => option.textContent?.trim());
    expect(labels).toEqual(['Music', 'AI', 'Git & GitHub', 'Learn']);

    if (!picker) throw new Error('No station picker');
    picker.value = 'git';
    picker.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(TestBed.inject(PlaylistLibrary).source()).toBe('git');
    expect(TestBed.inject(PlaylistPlayer).current().genre).toBe('git');
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

    expect(list?.querySelector('select[aria-label="Station"]')).not.toBeNull();
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
    for (const hidden of ['Tracks', 'Export favourites', 'Video']) {
      expect(button(hidden)).toBeUndefined();
    }
    expect(element.querySelector('select[aria-label="Station"]')).toBeNull();
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

  it('hides Sync, Video, Visual and Sky on a page without a music sky', () => {
    const { element, button } = render({ hasSky: false });
    expect(button('Video')).toBeUndefined();
    expect(element.querySelector('.sync')).toBeNull();
    expect(element.querySelector('select[aria-label="Milkdrop visual"]')).toBeNull();
    expect(element.querySelector('input[aria-label="Milkdrop visuals opacity"]')).toBeNull();
    expect(button('Tracks')).toBeDefined();
    expect(element.querySelector('input[aria-label="Playlist volume"]')).not.toBeNull();
  });

  it('takes the sky controls away as the page with the sky leaves, keeping the music', async () => {
    const { fixture, element, button, leaveSky, pauses } = render();
    button('Play')?.click();
    await fixture.whenStable();
    expect(button('Video')).toBeDefined();
    leaveSky();
    fixture.detectChanges();
    expect(button('Video')).toBeUndefined();
    expect(element.querySelector('.sync')).toBeNull();
    expect(pauses).not.toHaveBeenCalled();
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

  it('offers a smaller video once the card shows, and back again, still playing', async () => {
    const { fixture, element, button, make, pauses } = render();
    expect(button('Smaller video')).toBeUndefined();
    button('Play')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const shrink = button('Smaller video');
    expect(shrink?.getAttribute('aria-pressed')).toBe('false');
    expect(shrink?.title).toBe('Make the video smaller');
    shrink?.click();
    fixture.detectChanges();
    expect(shrink?.getAttribute('aria-pressed')).toBe('true');
    expect(shrink?.title).toBe('Back to the usual size');
    expect(element.querySelector('.card')?.classList).toContain('card--small');

    shrink?.click();
    fixture.detectChanges();
    expect(element.querySelector('.card')?.classList).not.toContain('card--small');
    expect(pauses).not.toHaveBeenCalled();
    expect(make).toHaveBeenCalledTimes(1);
  });

  it('turns Bigger off when Smaller is chosen, and Smaller off when Bigger is', async () => {
    const { fixture, element, button } = render();
    button('Play')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    const card = element.querySelector('.card');

    button('Bigger video')?.click();
    button('Smaller video')?.click();
    fixture.detectChanges();
    expect(button('Bigger video')?.getAttribute('aria-pressed')).toBe('false');
    expect(card?.classList).toContain('card--small');
    expect(card?.classList).not.toContain('card--large');

    button('Bigger video')?.click();
    fixture.detectChanges();
    expect(button('Smaller video')?.getAttribute('aria-pressed')).toBe('false');
    expect(card?.classList).toContain('card--large');
    expect(card?.classList).not.toContain('card--small');
  });

  it('keeps the smaller video at the 200 by 200 pixels YouTube needs at the least', async () => {
    const { fixture, element, button } = render();
    button('Play')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    button('Smaller video')?.click();
    fixture.detectChanges();

    const card = getComputedStyle(element.querySelector('.card') as Element);
    expect(card.boxSizing).toBe('content-box');
    expect([card.width, card.height]).toEqual(['200px', '200px']);
    expect(card.minWidth).toBe('200px');
  });
});
