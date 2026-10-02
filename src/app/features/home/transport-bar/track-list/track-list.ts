import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Track } from '../../../../core/playlist/playlist.types';

/** The playlist's tracks in order, the playing one marked; picking one reports its index. */
@Component({
  selector: 'app-track-list',
  templateUrl: './track-list.html',
  styleUrl: './track-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackList {
  readonly tracks = input.required<readonly Track[]>();
  readonly currentIndex = input.required<number>();
  readonly picked = output<number>();
}
