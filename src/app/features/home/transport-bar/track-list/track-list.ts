import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Track } from '../../../../core/playlist/playlist.types';

interface TrackRow {
  readonly track: Track;
  readonly isCurrent: boolean;
  readonly isFavorite: boolean;
}

/** The playlist's tracks in order, the playing one marked and each with its heart;
 *  picking one reports its index, and a heart reports its track. */
@Component({
  selector: 'app-track-list',
  templateUrl: './track-list.html',
  styleUrl: './track-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackList {
  readonly tracks = input.required<readonly Track[]>();
  readonly currentIndex = input.required<number>();
  readonly favoriteIds = input.required<ReadonlySet<string>>();
  readonly picked = output<number>();
  readonly favoriteToggled = output<Track>();

  protected readonly rows = computed((): TrackRow[] =>
    this.tracks().map((track, index) => ({
      track,
      isCurrent: index === this.currentIndex(),
      isFavorite: this.favoriteIds().has(track.videoId),
    })),
  );
}
