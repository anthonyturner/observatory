import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MusicPulse } from '../../../core/music-sync/music-pulse';
import { clockOf, spokenClockOf } from '../../../core/playlist/clock-format';
import { FavoritesStore } from '../../../core/playlist/favorites-store';
import { PlaylistLibrary, PlaylistSource } from '../../../core/playlist/playlist-library';
import { PlaylistPlayer } from '../../../core/playlist/playlist-player';
import { SoundPreference } from '../../../core/sound/sound-preference';
import { syncLabelOf } from './sync-label';
import { TrackList } from './track-list/track-list';

/** Mixes run for an hour: a step back to hear a drop again, a longer one forward. */
const BACK_STEP_S = 15;
const FORWARD_STEP_S = 30;

/** Home's playlist along the foot of the screen: the video, the seek bar, the transport, the
 *  heart, the Mix / Favourites switch, the sky's Sync and the volume, with the
 *  track list above. It plays instead of the
 *  generated score, never over it. The page provides the playlist and the pulse. */
@Component({
  selector: 'app-transport-bar',
  imports: [TrackList],
  templateUrl: './transport-bar.html',
  styleUrl: './transport-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'listOpen.set(false)' },
})
export class TransportBar {
  protected readonly player = inject(PlaylistPlayer);
  protected readonly library = inject(PlaylistLibrary);
  protected readonly favorites = inject(FavoritesStore);
  private readonly sound = inject(SoundPreference);
  private readonly pulse = inject(MusicPulse);
  protected readonly sync = computed(() => syncLabelOf(this.pulse.status()));
  private readonly screen = viewChild.required<ElementRef<HTMLElement>>('screen');

  protected readonly listOpen = signal(false);
  protected readonly backStep = BACK_STEP_S;
  protected readonly forwardStep = FORWARD_STEP_S;
  /** Where the pointer holds the seek bar mid-drag; the music's position otherwise. */
  private readonly dragged = signal<number | null>(null);
  protected readonly shownElapsed = computed(() => this.dragged() ?? this.player.elapsed());
  protected readonly elapsedLabel = computed(() => clockOf(this.shownElapsed()));
  protected readonly durationLabel = computed(() =>
    this.player.canSeek() ? clockOf(this.player.duration()) : '--:--',
  );
  protected readonly positionWords = computed(
    () => `${spokenClockOf(this.shownElapsed())} of ${spokenClockOf(this.player.duration())}`,
  );
  protected readonly hasStarted = computed(() => this.player.state() !== 'idle');
  protected readonly position = computed(
    () => `${this.player.index() + 1} / ${this.player.tracks().length}`,
  );
  protected readonly isFavorite = computed(() => this.favorites.has(this.player.current().videoId));
  protected readonly favoriteIds = computed(
    () => new Set(this.favorites.tracks().map((track) => track.videoId)),
  );
  protected readonly favoritesHint = computed(() =>
    this.library.hasFavorites()
      ? 'Play the tracks you have hearted'
      : 'No favourites yet: heart a track to save it here',
  );
  protected readonly status = computed(() =>
    this.player.state() === 'loading' ? 'Loading…' : this.player.current().artist,
  );

  constructor() {
    afterNextRender(() => this.player.attach(this.screen().nativeElement));
    effect(() => {
      if (this.sound.isOn()) untracked(() => this.player.pause());
    });
  }

  /** The first Play of a visit also asks to hear the tab, inside the same click. */
  protected toggle(): void {
    if (!this.player.isPlaying()) {
      this.silenceScore();
      this.pulse.listenOnce();
    }
    this.player.toggle();
  }

  protected toggleSync(): void {
    if (this.pulse.isListening()) this.pulse.stop();
    else this.pulse.listen();
  }

  protected next(): void {
    this.silenceScore();
    this.player.next();
  }

  protected previous(): void {
    this.silenceScore();
    this.player.previous();
  }

  protected pick(index: number): void {
    this.silenceScore();
    this.player.select(index);
    this.listOpen.set(false);
  }

  protected choose(source: PlaylistSource): void {
    if (this.player.isPlaying()) this.silenceScore();
    this.library.choose(source);
  }

  protected onScrub(event: Event): void {
    this.dragged.set(Number((event.target as HTMLInputElement).value));
  }

  protected onScrubbed(event: Event): void {
    this.player.seek(Number((event.target as HTMLInputElement).value));
    this.dragged.set(null);
  }

  protected onVolume(event: Event): void {
    this.player.setVolume(Number((event.target as HTMLInputElement).value));
  }

  private silenceScore(): void {
    if (this.sound.isOn()) this.sound.toggle();
  }
}
