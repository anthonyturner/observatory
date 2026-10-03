import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PLAYLIST_TRACKS, PlaylistPlayer } from './playlist-player';
import { Track } from './playlist.types';
import {
  VIDEO_PLAYER_FACTORY,
  VideoPlayer,
  VideoPlayerEvents,
  VideoPlayerOptions,
} from './video-player';

const TRACKS: readonly Track[] = [
  { videoId: 'aaaaaaaaaaa', title: 'One', artist: 'A', genre: 'trance' },
  { videoId: 'bbbbbbbbbbb', title: 'Two', artist: 'B', genre: 'trance' },
  { videoId: 'ccccccccccc', title: 'Three', artist: 'C', genre: 'trance' },
];

class FakePlayer implements VideoPlayer {
  loaded: string[] = [];
  plays = 0;
  pauses = 0;
  volume: number | null = null;
  disposed = false;
  load(videoId: string): void {
    this.loaded.push(videoId);
  }
  play(): void {
    this.plays++;
  }
  pause(): void {
    this.pauses++;
  }
  setVolume(volume: number): void {
    this.volume = volume;
  }
  time = 0;
  length = 0;
  seeks: number[] = [];
  seekTo(seconds: number): void {
    this.seeks.push(seconds);
    this.time = seconds;
  }
  currentTime(): number {
    return this.time;
  }
  duration(): number {
    return this.length;
  }
  dispose(): void {
    this.disposed = true;
  }
}

function setup(make?: (options: VideoPlayerOptions) => Promise<VideoPlayer>) {
  const fake = new FakePlayer();
  const made: VideoPlayerOptions[] = [];
  const errors: unknown[] = [];
  TestBed.configureTestingModule({
    providers: [
      PlaylistPlayer,
      { provide: PLAYLIST_TRACKS, useValue: TRACKS },
      {
        provide: VIDEO_PLAYER_FACTORY,
        useValue: (options: VideoPlayerOptions) => {
          made.push(options);
          return make ? make(options) : Promise.resolve(fake);
        },
      },
      { provide: ErrorHandler, useValue: { handleError: (e: unknown) => errors.push(e) } },
    ],
  });
  const playlist = TestBed.inject(PlaylistPlayer);
  playlist.attach(document.createElement('div'));
  const events = (): VideoPlayerEvents => made[0].events;
  return { playlist, fake, made, errors, events };
}

const settle = (): Promise<void> => new Promise((done) => setTimeout(done));

describe('PlaylistPlayer', () => {
  it('loads nothing until the first play, then starts on the first track', async () => {
    const { playlist, made, events } = setup();
    expect(made.length).toBe(0);
    expect(playlist.state()).toBe('idle');

    playlist.toggle();
    expect(playlist.state()).toBe('loading');
    expect(made[0].videoId).toBe('aaaaaaaaaaa');
    await settle();
    events().playing();
    expect(playlist.isPlaying()).toBe(true);
  });

  it('pauses and plays the same player once it exists', async () => {
    const { playlist, fake, made, events } = setup();
    playlist.play();
    await settle();
    events().playing();
    playlist.toggle();
    expect(fake.pauses).toBe(1);
    events().paused();
    playlist.toggle();
    expect(fake.plays).toBe(1);
    expect(made.length).toBe(1);
  });

  it('plays the next track when one ends, wrapping after the last', async () => {
    const { playlist, fake, events } = setup();
    playlist.select(2);
    await settle();
    events().ended();
    expect(playlist.index()).toBe(0);
    expect(fake.loaded).toEqual(['aaaaaaaaaaa']);
  });

  it('steps back round to the last track', async () => {
    const { playlist, fake } = setup();
    playlist.play();
    await settle();
    playlist.previous();
    expect(playlist.current().title).toBe('Three');
    expect(fake.loaded).toEqual(['ccccccccccc']);
  });

  it('skips a track YouTube refuses, and stops once every track has been refused', async () => {
    const { playlist, events } = setup();
    playlist.play();
    await settle();
    events().failed();
    expect(playlist.index()).toBe(1);
    events().failed();
    events().failed();
    expect(playlist.index()).toBe(2);
    expect(playlist.state()).toBe('paused');
  });

  it('plays a track picked while the player was still loading', async () => {
    const { playlist, fake } = setup();
    playlist.play();
    playlist.select(1);
    await settle();
    expect(fake.loaded).toEqual(['bbbbbbbbbbb']);
  });

  it('keeps the volume between 0 and 1 and hands it to the player', async () => {
    const { playlist, fake } = setup();
    playlist.setVolume(1.4);
    expect(playlist.volume()).toBe(1);
    playlist.play();
    await settle();
    playlist.setVolume(0.25);
    expect(fake.volume).toBe(0.25);
  });

  it('reports a player that will not load and returns to idle', async () => {
    const { playlist, errors } = setup(() => Promise.reject(new Error('blocked')));
    playlist.play();
    await settle();
    expect(playlist.state()).toBe('idle');
    expect(errors.length).toBe(1);
  });

  it('lets the player go when the page does', async () => {
    const { playlist, fake } = setup();
    playlist.play();
    await settle();
    TestBed.resetTestingModule();
    expect(fake.disposed).toBe(true);
  });

  it('plays another list from its top, carrying on if music was playing', async () => {
    const { playlist, fake, events } = setup();
    playlist.select(2);
    await settle();
    events().playing();
    const other: Track[] = [{ videoId: 'zzzzzzzzzzz', title: 'Z', artist: 'Z', genre: 'techno' }];
    playlist.useTracks(other);
    expect(playlist.index()).toBe(0);
    expect(playlist.current().title).toBe('Z');
    expect(fake.loaded.at(-1)).toBe('zzzzzzzzzzz');
  });

  it('loads the new list on the next Play when the switch came while paused', async () => {
    const { playlist, fake, events } = setup();
    playlist.play();
    await settle();
    events().paused();
    playlist.useTracks([TRACKS[2]]);
    expect(fake.loaded).toEqual([]);
    playlist.play();
    expect(fake.loaded).toEqual(['ccccccccccc']);
    expect(fake.plays).toBe(0);
  });

  it('keeps the current track current when its list changes around it', () => {
    const { playlist } = setup();
    playlist.select(1);
    playlist.refreshTracks([TRACKS[2], TRACKS[1]]);
    expect(playlist.index()).toBe(1);
    expect(playlist.current().title).toBe('Two');
  });

  it('plays the track that takes the place of one taken out while playing', async () => {
    const { playlist, fake, events } = setup();
    playlist.select(1);
    await settle();
    events().playing();
    playlist.refreshTracks([TRACKS[0], TRACKS[2]]);
    expect(playlist.current().title).toBe('Three');
    expect(fake.loaded.at(-1)).toBe('ccccccccccc');
  });

  it('ignores an empty list', () => {
    const { playlist } = setup();
    playlist.useTracks([]);
    playlist.refreshTracks([]);
    expect(playlist.tracks()).toEqual(TRACKS);
  });

  describe('position in a track', () => {
    afterEach(() => vi.useRealTimers());

    async function playing() {
      const ctx = setup();
      ctx.playlist.play();
      await settle();
      ctx.fake.length = 300;
      ctx.fake.time = 12;
      vi.useFakeTimers();
      ctx.events().playing();
      return ctx;
    }

    it('follows the music while it plays, and stops following when paused', async () => {
      const { playlist, fake, events } = await playing();
      expect(playlist.elapsed()).toBe(12);
      expect(playlist.duration()).toBe(300);
      fake.time = 13;
      vi.advanceTimersByTime(500);
      expect(playlist.elapsed()).toBe(13);
      events().paused();
      fake.time = 99;
      vi.advanceTimersByTime(2000);
      expect(playlist.elapsed()).toBe(13);
    });

    it('seeks within the track, never past either end', async () => {
      const { playlist, fake } = await playing();
      playlist.seek(120);
      playlist.seek(-5);
      playlist.seek(900);
      expect(fake.seeks).toEqual([120, 0, 300]);
      expect(playlist.elapsed()).toBe(300);
    });

    it('skips forward and back from where the music is', async () => {
      const { playlist, fake } = await playing();
      playlist.skip(30);
      playlist.skip(-15);
      expect(fake.seeks).toEqual([42, 27]);
    });

    it('starts the next track from the top', async () => {
      const { playlist } = await playing();
      playlist.next();
      expect(playlist.elapsed()).toBe(0);
      expect(playlist.canSeek()).toBe(false);
    });

    it('cannot seek before the length is known', () => {
      const { playlist, fake } = setup();
      playlist.seek(10);
      expect(fake.seeks).toEqual([]);
    });
  });

  describe('moving to another host', () => {
    it('only remembers the host before anything plays', () => {
      const { playlist, made } = setup();
      const elsewhere = document.createElement('div');
      playlist.attach(elsewhere);
      expect(made.length).toBe(0);
      playlist.play();
      expect(made[0].host).toBe(elsewhere);
    });

    it('rebuilds a playing player there, from the same second', async () => {
      const { playlist, fake, made, events } = setup();
      playlist.select(1);
      await settle();
      events().playing();
      fake.time = 42.6;
      const elsewhere = document.createElement('div');
      playlist.attach(elsewhere);
      expect(fake.disposed).toBe(true);
      expect(made[1]).toEqual(
        expect.objectContaining({
          host: elsewhere,
          videoId: 'bbbbbbbbbbb',
          startS: 42.6,
          autoplay: true,
        }),
      );
      expect(playlist.state()).toBe('loading');
    });

    it('keeps a paused player paused there', async () => {
      const { playlist, fake, made, events } = setup();
      playlist.play();
      await settle();
      events().paused();
      playlist.attach(document.createElement('div'));
      expect(made[1].autoplay).toBe(false);
      expect(playlist.state()).toBe('paused');
      await settle();
      playlist.play();
      expect(fake.plays).toBe(1);
      expect(made.length).toBe(2);
    });

    it('does nothing for the host it already has', async () => {
      const { playlist, made } = setup();
      const host = document.createElement('div');
      playlist.attach(host);
      playlist.play();
      await settle();
      playlist.attach(host);
      expect(made.length).toBe(1);
    });

    it('moves a player that was still loading once it is ready', async () => {
      const { playlist, fake, made } = setup();
      playlist.play();
      const elsewhere = document.createElement('div');
      playlist.attach(elsewhere);
      expect(made.length).toBe(1);
      await settle();
      expect(fake.disposed).toBe(true);
      expect(made[1].host).toBe(elsewhere);
    });
  });
});
