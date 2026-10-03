import { Provider, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MilkdropOpacity } from '../../../core/music-sync/milkdrop/milkdrop-opacity';
import { VideoBackground } from '../../../core/playlist/video-background';
import { MusicScene } from '../../../core/music-sync/motifs/motif-layer';
import { MUSIC_CANVAS, MusicCanvas } from '../../../core/music-sync/music-painter';
import { MusicPulse } from '../../../core/music-sync/music-pulse';
import { MusicFrame } from '../../../core/music-sync/music-sync.types';
import { AUDIO_TAP, AudioTap } from '../../../core/music-sync/tab-audio';
import { SongName } from '../../../core/music-sync/title-card';
import { VisualTheme, themeFor } from '../../../core/music-sync/visual-theme';
import { PLAYLIST_TRACKS, PlaylistPlayer } from '../../../core/playlist/playlist-player';
import { MusicSky } from './music-sky';

class FakeCanvas implements MusicCanvas {
  themes: VisualTheme[] = [];
  scenes: MusicScene[] = [];
  frames: MusicFrame[] = [];
  clears = 0;
  disposed = false;
  canDraw(): boolean {
    return true;
  }
  setScene(scene: MusicScene): void {
    this.scenes.push(scene);
  }
  setTheme(theme: VisualTheme): void {
    this.themes.push(theme);
  }
  songs: SongName[] = [];
  opacities: number[] = [];
  setMilkdropOpacity(level: number): void {
    this.opacities.push(level);
  }
  announce(song: SongName): void {
    this.songs.push(song);
  }
  setSound(): void {
    // The fake draws nothing, so it has nothing to hear.
  }
  paint(frame: MusicFrame): void {
    this.frames.push(frame);
  }
  clear(): void {
    this.clears++;
  }
  dispose(): void {
    this.disposed = true;
  }
}

const tap: AudioTap = {
  binHz: 20,
  binCount: 8,
  read: (into) => into.fill(0),
  onEnded: () => undefined,
  close: () => undefined,
};

async function render(providers: Provider[] = []) {
  const canvas = new FakeCanvas();
  TestBed.configureTestingModule({
    providers: [
      PlaylistPlayer,
      MusicPulse,
      { provide: AUDIO_TAP, useValue: () => Promise.resolve(tap) },
      { provide: MUSIC_CANVAS, useValue: () => canvas },
      ...providers,
    ],
  });
  const fixture = TestBed.createComponent(MusicSky);
  fixture.detectChanges();
  await fixture.whenStable();
  return {
    fixture,
    canvas,
    pulse: TestBed.inject(MusicPulse),
    playlist: TestBed.inject(PlaylistPlayer),
    tracks: TestBed.inject(PLAYLIST_TRACKS),
  };
}

const frame = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => done()));

describe('MusicSky', () => {
  it('draws nothing until the page is listening', async () => {
    const { canvas } = await render();
    await frame();
    expect(canvas.frames).toEqual([]);
  });

  it('dresses the sky for the track playing, and changes with it', async () => {
    const { canvas, playlist, tracks } = await render();
    expect(canvas.themes.at(-1)).toEqual(themeFor(tracks[0]));
    playlist.select(1);
    TestBed.tick();
    expect(canvas.themes.at(-1)).toEqual(themeFor(tracks[1]));
  });

  it('changes the look as the track plays on, and only when it changes', async () => {
    const [track] = TestBed.inject(PLAYLIST_TRACKS);
    TestBed.resetTestingModule();
    const elapsed = signal(0);
    const { canvas } = await render([
      { provide: PlaylistPlayer, useValue: { current: signal(track), elapsed } },
    ]);
    const before = canvas.themes.length;
    elapsed.set(1);
    TestBed.tick();
    expect(canvas.themes.length).toBe(before);

    let changedS = 1;
    while (themeFor(track, changedS).motif === themeFor(track).motif) changedS++;
    elapsed.set(changedS);
    TestBed.tick();
    expect(canvas.themes.length).toBe(before + 1);
    expect(canvas.themes.at(-1)).toEqual(themeFor(track, changedS));
  });

  it('names the song playing, and each new one as it starts', async () => {
    const { canvas, playlist, tracks } = await render();
    expect(canvas.songs.at(-1)).toEqual({ title: tracks[0].title, artist: tracks[0].artist });
    playlist.select(1);
    TestBed.tick();
    expect(canvas.songs.at(-1)).toEqual({ title: tracks[1].title, artist: tracks[1].artist });
  });

  it('sets Milkdrop as strong as the slider asks, and follows it', async () => {
    const { canvas } = await render();
    const opacity = TestBed.inject(MilkdropOpacity);
    expect(canvas.opacities.at(-1)).toBe(opacity.level());
    opacity.set(0.3);
    TestBed.tick();
    expect(canvas.opacities.at(-1)).toBe(0.3);
  });

  it('hides Milkdrop while the video fills the background, and brings it back', async () => {
    const { canvas } = await render();
    const background = TestBed.inject(VideoBackground);
    try {
      background.toggle();
      TestBed.tick();
      expect(canvas.opacities.at(-1)).toBe(0);
      background.toggle();
      TestBed.tick();
      expect(canvas.opacities.at(-1)).toBe(TestBed.inject(MilkdropOpacity).level());
    } finally {
      if (background.isOn()) background.toggle();
    }
  });

  it('moves while listening and clears when listening stops', async () => {
    const { fixture, canvas, pulse } = await render();
    pulse.listen();
    await fixture.whenStable();
    await frame();
    await frame();
    expect(canvas.frames.length).toBeGreaterThan(0);

    const clearsBefore = canvas.clears;
    pulse.stop();
    await fixture.whenStable();
    await frame();
    expect(canvas.clears).toBeGreaterThan(clearsBefore);
    const drawn = canvas.frames.length;
    await frame();
    expect(canvas.frames.length).toBe(drawn);
  });

  it('puts the canvas away when the page goes', async () => {
    const { canvas } = await render();
    TestBed.resetTestingModule();
    expect(canvas.disposed).toBe(true);
  });
});
