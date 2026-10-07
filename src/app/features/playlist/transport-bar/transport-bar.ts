import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { BeatStrength } from '../../../core/music-sync/beat-strength';
import { MilkdropChoice } from '../../../core/music-sync/milkdrop/milkdrop-choice';
import { MusicPulse } from '../../../core/music-sync/music-pulse';
import { MusicSkyPresence } from '../../../core/music-sync/music-sky-presence';
import { SoundSourceChoice } from '../../../core/music-sync/sources/sound-source-choice';
import { clockOf, spokenClockOf } from '../../../core/playlist/clock-format';
import { FavoritesStore } from '../../../core/playlist/favorites-store';
import { PlaylistBarFold } from '../../../core/playlist/playlist-bar-fold';
import { PlaylistLibrary } from '../../../core/playlist/playlist-library';
import { StationId } from '../../../core/playlist/playlist-stations';
import { PlaylistPlayer } from '../../../core/playlist/playlist-player';
import { VideoBackground } from '../../../core/playlist/video-background';
import { VideoCardSize } from '../../../core/playlist/video-card-size';
import { PageScore } from '../../../core/sound/page-score';
import { MilkdropOpacity } from '../../../core/music-sync/milkdrop/milkdrop-opacity';
import { FavoritesTransfer, NOTHING_TO_EXPORT } from './favorites-transfer';
import { SoundSourcePicker } from './sound-source-picker/sound-source-picker';
import { SyncLabel, syncLabelOf } from './sync-label';
import { TrackList } from './track-list/track-list';
import { VideoSizeButtons } from './video-size-buttons/video-size-buttons';

/** Mixes run for an hour: a step back to hear a drop again, a longer one forward. */
const BACK_STEP_S = 15;
const FORWARD_STEP_S = 30;

/** The playlist along the foot of every page: the video, the seek bar, the transport,
 *  the heart, the Station picker and Favourites switch, the favourites file, the sky's Sync and
 *  where it hears the music, the Video switch, Milkdrop's visual and opacity, the
 *  beat's strength, and the volume, with the track list above; folded, only the
 *  seek bar, the transport, the heart and the song's name stay. It plays instead of
 *  the page's score, never over it. The app shell shows it, so the music carries
 *  across pages. */
@Component({
  selector: 'app-transport-bar',
  imports: [TrackList, SoundSourcePicker, VideoSizeButtons],
  providers: [FavoritesTransfer],
  templateUrl: './transport-bar.html',
  styleUrl: './transport-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown.escape)': 'listOpen.set(false)',
    '[class.still]': 'motion.isStill()',
    '[class.folded]': 'fold.isFolded()',
  },
})
export class TransportBar {
  protected readonly player = inject(PlaylistPlayer);
  protected readonly library = inject(PlaylistLibrary);
  protected readonly favorites = inject(FavoritesStore);
  protected readonly transfer = inject(FavoritesTransfer);
  private readonly score = inject(PageScore);
  protected readonly pulse = inject(MusicPulse);
  protected readonly soundSources = inject(SoundSourceChoice);
  protected readonly motion = inject(MotionPreference);
  protected readonly milkdrop = inject(MilkdropChoice);
  protected readonly milkdropOpacity = inject(MilkdropOpacity);
  protected readonly beatStrength = inject(BeatStrength);
  protected readonly videoBackground = inject(VideoBackground);
  protected readonly videoSize = inject(VideoCardSize);
  /** Sync, Visual and Sky only do something on a page with a music sky; Video on any
   *  page with a backdrop for it. */
  protected readonly sky = inject(MusicSkyPresence);
  protected readonly fold = inject(PlaylistBarFold);
  /** Null where no source can be heard, so Sync is left out. */
  protected readonly sync = computed((): SyncLabel | null => {
    const selected = this.soundSources.selected();
    return selected && syncLabelOf(this.pulse.status(), selected.source.guide);
  });
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
  /** On Home the video takes Milkdrop's place; elsewhere it goes beneath the stars. */
  protected readonly videoHint = computed(() => {
    if (this.sky.isShown()) {
      return this.videoBackground.isOn()
        ? 'Back to the Milkdrop visuals behind the page'
        : 'Play the video full screen behind the page instead of Milkdrop';
    }
    return this.videoBackground.isOn()
      ? 'Back to the video window by the bar'
      : 'Play the video full screen behind the stars';
  });
  /** The card shows the video unless it is filling the page's background instead. */
  protected readonly isCardShown = computed(
    () => this.hasStarted() && !this.videoBackground.isShown(),
  );
  protected readonly position = computed(
    () => `${this.player.index() + 1} / ${this.player.tracks().length}`,
  );
  protected readonly isFavorite = computed(() => this.favorites.has(this.player.current().videoId));
  protected readonly favoriteIds = computed(
    () => new Set(this.favorites.tracks().map((track) => track.videoId)),
  );
  protected readonly favoritesHint = computed(() =>
    this.library.hasFavorites()
      ? this.library.source() === 'favorites'
        ? 'Back to the station'
        : 'Play the tracks you have hearted'
      : 'No favourites yet: heart a track to save it here',
  );
  protected readonly exportHint = computed(() =>
    this.library.hasFavorites()
      ? 'Save your favourites to a file, to import on another site or browser'
      : NOTHING_TO_EXPORT,
  );
  protected readonly status = computed(() =>
    this.player.state() === 'loading' ? 'Loading…' : this.player.current().artist,
  );

  constructor() {
    afterRenderEffect(() => {
      if (!this.videoBackground.isShown()) this.player.attach(this.screen().nativeElement);
    });
    effect(() => {
      if (this.score.isOn()) untracked(() => this.player.pause());
    });
  }

  /** The first Play of a visit also asks to hear the tab, inside the same click. */
  protected toggle(): void {
    if (!this.player.isPlaying()) {
      this.score.silence();
      this.pulse.listenOnce();
    }
    this.player.toggle();
  }

  protected toggleSync(): void {
    if (this.pulse.isListening()) this.pulse.stop();
    else this.pulse.listen();
  }

  protected next(): void {
    this.score.silence();
    this.player.next();
  }

  protected previous(): void {
    this.score.silence();
    this.player.previous();
  }

  protected pick(index: number): void {
    this.score.silence();
    this.player.select(index);
    this.listOpen.set(false);
  }

  /** The select only offers the stations' ids. */
  protected onStation(event: Event): void {
    if (this.player.isPlaying()) this.score.silence();
    this.library.choose((event.target as HTMLSelectElement).value as StationId);
  }

  protected toggleFavorites(): void {
    if (this.player.isPlaying()) this.score.silence();
    this.library.toggleFavorites();
  }

  protected onScrub(event: Event): void {
    this.dragged.set(Number((event.target as HTMLInputElement).value));
  }

  protected onScrubbed(event: Event): void {
    this.player.seek(Number((event.target as HTMLInputElement).value));
    this.dragged.set(null);
  }

  protected importPicked(picker: HTMLInputElement): void {
    const file = picker.files?.[0];
    // Cleared so that picking the same file again still reports a change.
    picker.value = '';
    if (file) this.transfer.importFile(file);
  }

  protected onMilkdropOpacity(event: Event): void {
    this.milkdropOpacity.set(Number((event.target as HTMLInputElement).value));
  }

  protected onBeatStrength(event: Event): void {
    this.beatStrength.set(Number((event.target as HTMLInputElement).value));
  }

  protected onVolume(event: Event): void {
    this.player.setVolume(Number((event.target as HTMLInputElement).value));
  }

  /** The select's empty value is Auto. */
  protected onMilkdropPreset(event: Event): void {
    this.milkdrop.choose((event.target as HTMLSelectElement).value || null);
  }

  /** Folding hides the Tracks button, so it closes the list too. */
  protected toggleFold(): void {
    this.fold.toggle();
    if (this.fold.isFolded()) this.listOpen.set(false);
  }
}
