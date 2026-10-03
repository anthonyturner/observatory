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
import {
  VIDEO_PLAYER_FACTORY,
  VideoPlayer,
  VideoPlayerEvents,
  VideoPlayerOptions,
} from './video-player';

/** How many tracks one visit's mix holds. */
const MIX_SIZE = 12;

/** The tracks a page's playlist plays, in order: a fresh mix from the pool on each load. */
export const PLAYLIST_TRACKS = new InjectionToken<readonly Track[]>('PLAYLIST_TRACKS', {
  providedIn: 'root',
  factory: () => pickShuffled(MUSIC_POOL, MIX_SIZE, Math.random),
});

const DEFAULT_VOLUME = 0.6;
/** How often the bar's position follows the music; the player has no event for it. */
const PROGRESS_MS = 500;

/** A playlist and where it is in it. Provided by the component that shows it, so
 *  leaving the page stops the music. Nothing loads until the first play. */
@Injectable()
export class PlaylistPlayer {
  private readonly makePlayer = inject(VIDEO_PLAYER_FACTORY);
  private readonly errors = inject(ErrorHandler);
  private readonly list = signal<readonly Track[]>(inject(PLAYLIST_TRACKS));
  private readonly position = signal(0);
  private readonly playback = signal<PlaybackState>('idle');
  private readonly level = signal(DEFAULT_VOLUME);
  private readonly elapsedS = signal(0);
  private readonly lengthS = signal(0);

  /** The list playing now; never empty. */
  readonly tracks: Signal<readonly Track[]> = this.list.asReadonly();
  readonly index: Signal<number> = this.position.asReadonly();
  readonly state: Signal<PlaybackState> = this.playback.asReadonly();
  /** From 0 to 1. */
  readonly volume: Signal<number> = this.level.asReadonly();
  /** Seconds into the current track. */
  readonly elapsed: Signal<number> = this.elapsedS.asReadonly();
  /** The current track's length in seconds; 0 until the player knows it. */
  readonly duration: Signal<number> = this.lengthS.asReadonly();
  readonly canSeek = computed(() => this.lengthS() > 0);
  readonly current = computed(() => this.list()[this.position()]);
  readonly isPlaying = computed(() => this.playback() === 'playing');

  private host: HTMLElement | null = null;
  private player: VideoPlayer | null = null;
  private isStarting = false;
  private isDestroyed = false;
  /** The video the player holds, which a list change can leave behind the current track. */
  private loadedId: string | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  /** Tracks refused in a row; a whole list of them stops the skipping. */
  private failuresInRow = 0;

  private readonly events: VideoPlayerEvents = {
    playing: () => {
      this.failuresInRow = 0;
      this.playback.set('playing');
      this.followProgress();
    },
    paused: () => {
      this.playback.set('paused');
      this.stopFollowing();
    },
    ended: () => this.goTo(nextIndex(this.position(), this.list().length)),
    failed: () => this.skipRefused(),
  };

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.isDestroyed = true;
      this.stopFollowing();
      this.player?.dispose();
    });
  }

  /** Where the player draws; it stays visible while it plays, as YouTube's terms ask.
   *  A new host once the player exists moves it there, carrying on where it was. */
  attach(host: HTMLElement): void {
    if (host === this.host) return;
    this.host = host;
    if (this.player) this.move(this.player);
  }

  toggle(): void {
    if (this.isPlaying()) this.pause();
    else this.play();
  }

  play(): void {
    if (!this.player) this.start();
    else if (this.loadedId !== this.current().videoId) this.goTo(this.position());
    else this.player.play();
  }

  pause(): void {
    this.player?.pause();
  }

  next(): void {
    this.select(nextIndex(this.position(), this.list().length));
  }

  previous(): void {
    this.select(previousIndex(this.position(), this.list().length));
  }

  select(index: number): void {
    this.failuresInRow = 0;
    this.goTo(index);
  }

  /** Plays from another list, from its top; music that was playing carries on. */
  useTracks(tracks: readonly Track[]): void {
    if (tracks.length === 0) return;
    const wasActive = this.isActive();
    this.list.set(tracks);
    this.failuresInRow = 0;
    if (wasActive) this.goTo(0);
    else this.position.set(0);
  }

  /** The same list, changed: the current track stays current while it is still in
   *  it; if it was taken out, the track that took its place plays instead. */
  refreshTracks(tracks: readonly Track[]): void {
    if (tracks.length === 0) return;
    const currentId = this.current().videoId;
    this.list.set(tracks);
    const kept = tracks.findIndex((track) => track.videoId === currentId);
    if (kept >= 0) return this.position.set(kept);
    const slid = Math.min(this.position(), tracks.length - 1);
    if (this.isActive()) this.goTo(slid);
    else this.position.set(slid);
  }

  /** Moves to `seconds` into the current track, kept within it. */
  seek(seconds: number): void {
    if (!this.player || !this.canSeek()) return;
    const to = Math.min(Math.max(seconds, 0), this.lengthS());
    this.player.seekTo(to);
    this.elapsedS.set(to);
  }

  /** Jumps `seconds` forward, or back when negative. */
  skip(seconds: number): void {
    this.seek(this.elapsedS() + seconds);
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
    this.stopFollowing();
    this.elapsedS.set(0);
    this.lengthS.set(0);
    this.loadedId = this.current().videoId;
    this.player.load(this.loadedId);
  }

  private followProgress(): void {
    this.stopFollowing();
    this.readProgress();
    this.progressTimer = setInterval(() => this.readProgress(), PROGRESS_MS);
  }

  private stopFollowing(): void {
    if (this.progressTimer !== null) clearInterval(this.progressTimer);
    this.progressTimer = null;
  }

  private readProgress(): void {
    if (!this.player) return;
    this.elapsedS.set(this.player.currentTime());
    this.lengthS.set(this.player.duration());
  }

  private isActive(): boolean {
    return this.playback() === 'playing' || this.playback() === 'loading';
  }

  private skipRefused(): void {
    this.failuresInRow++;
    if (this.failuresInRow >= this.list().length) this.playback.set('paused');
    else this.goTo(nextIndex(this.position(), this.list().length));
  }

  /** YouTube reloads a frame moved about the page, so the player is built afresh in
   *  the new host, from the same second and playing or paused as it was. */
  private move(player: VideoPlayer): void {
    const startS = player.currentTime();
    const autoplay = this.isActive();
    this.stopFollowing();
    player.dispose();
    this.player = null;
    this.start({ startS, autoplay });
  }

  private start(from: Pick<VideoPlayerOptions, 'startS' | 'autoplay'> = {}): void {
    if (this.isStarting || !this.host) return;
    this.isStarting = true;
    if (from.autoplay !== false) this.playback.set('loading');
    const host = this.host;
    const videoId = this.current().videoId;
    this.makePlayer({ host, videoId, volume: this.level(), events: this.events, ...from })
      .then((player) => {
        this.isStarting = false;
        this.started(player, videoId, host);
      })
      .catch((error: unknown) => {
        this.isStarting = false;
        this.playback.set('idle');
        this.errors.handleError(error);
      });
  }

  /** A track picked while the player was loading plays in place of the first, and a
   *  host attached meanwhile takes the player over. */
  private started(player: VideoPlayer, videoId: string, host: HTMLElement): void {
    if (this.isDestroyed) return player.dispose();
    this.player = player;
    this.loadedId = this.current().videoId;
    player.setVolume(this.level());
    if (this.loadedId !== videoId) player.load(this.loadedId);
    if (this.host !== host) this.move(player);
  }
}
