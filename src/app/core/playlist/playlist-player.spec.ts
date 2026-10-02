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
  { videoId: 'aaaaaaaaaaa', title: 'One', artist: 'A' },
  { videoId: 'bbbbbbbbbbb', title: 'Two', artist: 'B' },
  { videoId: 'ccccccccccc', title: 'Three', artist: 'C' },
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
});
