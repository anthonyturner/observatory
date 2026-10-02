import {
  DestroyRef,
  ErrorHandler,
  Injectable,
  InjectionToken,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { PlaybackState, Track } from './playlist.types';
import { MUSIC_POOL } from './music-pool';
import { nextIndex, pickShuffled, previousIndex } from './playlist-order';
import { VIDEO_PLAYER_FACTORY, VideoPlayer, VideoPlayerEvents } from './video-player';

/** How many tracks one visit's mix holds. */
const MIX_SIZE = 12;

/** The tracks a page's playlist plays, in order: a fresh mix from the pool on each load. */
export const PLAYLIST_TRACKS = new InjectionToken<readonly Track[]>('PLAYLIST_TRACKS', {
  providedIn: 'root',
  factory: () => pickShuffled(MUSIC_POOL, MIX_SIZE, Math.random),
});

const DEFAULT_VOLUME = 0.6;

/** A playlist and where it is in it. Provided by the component that shows it, so
 *  leaving the page stops the music. Nothing loads until the first play. */
@Injectable()
export class PlaylistPlayer {
  private readonly makePlayer = inject(VIDEO_PLAYER_FACTORY);
  private readonly errors = inject(ErrorHandler);
  readonly tracks = inject(PLAYLIST_TRACKS);

  private readonly position = signal(0);
  private readonly playback = signal<PlaybackState>('idle');
  private readonly level = signal(DEFAULT_VOLUME);

  readonly index: Signal<number> = this.position.asReadonly();
  readonly state: Signal<PlaybackState> = this.playback.asReadonly();
  /** From 0 to 1. */
  readonly volume: Signal<number> = this.level.asReadonly();
  readonly current = computed(() => this.tracks[this.position()]);
  readonly isPlaying = computed(() => this.playback() === 'playing');

  private host: HTMLElement | null = null;
  private player: VideoPlayer | null = null;
  private isStarting = false;
  private isDestroyed = false;
  /** Tracks refused in a row; a whole list of them stops the skipping. */
  private failuresInRow = 0;

  private readonly events: VideoPlayerEvents = {
    playing: () => {
      this.failuresInRow = 0;
      this.playback.set('playing');
    },
    paused: () => this.playback.set('paused'),
    ended: () => this.goTo(nextIndex(this.position(), this.tracks.length)),
    failed: () => this.skipRefused(),
  };

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.isDestroyed = true;
      this.player?.dispose();
    });
  }

  /** Where the player draws; it stays visible while it plays, as YouTube's terms ask. */
  attach(host: HTMLElement): void {
    this.host = host;
  }

  toggle(): void {
    if (this.isPlaying()) this.pause();
    else this.play();
  }

  play(): void {
    if (this.player) this.player.play();
    else this.start();
  }

  pause(): void {
    this.player?.pause();
  }

  next(): void {
    this.select(nextIndex(this.position(), this.tracks.length));
  }

  previous(): void {
    this.select(previousIndex(this.position(), this.tracks.length));
  }

  select(index: number): void {
    this.failuresInRow = 0;
    this.goTo(index);
  }

  setVolume(volume: number): void {
    const level = Math.min(1, Math.max(0, volume));
    this.level.set(level);
    this.player?.setVolume(level);
  }

  private goTo(index: number): void {
    this.position.set(index);
    if (!this.player) return this.start();
    this.playback.set('loading');
    this.player.load(this.current().videoId);
  }

  private skipRefused(): void {
    this.failuresInRow++;
    if (this.failuresInRow >= this.tracks.length) this.playback.set('paused');
    else this.goTo(nextIndex(this.position(), this.tracks.length));
  }

  private start(): void {
    if (this.isStarting || !this.host) return;
    this.isStarting = true;
    this.playback.set('loading');
    const videoId = this.current().videoId;
    this.makePlayer({ host: this.host, videoId, volume: this.level(), events: this.events })
      .then((player) => this.started(player, videoId))
      .catch((error: unknown) => {
        this.playback.set('idle');
        this.errors.handleError(error);
      })
      .finally(() => (this.isStarting = false));
  }

  /** A track picked while the player was loading plays in place of the first. */
  private started(player: VideoPlayer, videoId: string): void {
    if (this.isDestroyed) return player.dispose();
    this.player = player;
    player.setVolume(this.level());
    if (this.current().videoId !== videoId) player.load(this.current().videoId);
  }
}
