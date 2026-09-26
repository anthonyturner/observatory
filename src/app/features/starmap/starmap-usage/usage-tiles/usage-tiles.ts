import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TileView } from '../usage-tile-view';

/** A row of tiles for the numbers someone came for. */
@Component({
  selector: 'app-usage-tiles',
  templateUrl: './usage-tiles.html',
  styleUrl: './usage-tiles.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageTiles {
  readonly tiles = input.required<readonly TileView[]>();
}
