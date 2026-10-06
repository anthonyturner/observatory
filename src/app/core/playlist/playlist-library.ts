import { Injectable, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { FavoritesStore } from './favorites-store';
import { PlaylistPlayer } from './playlist-player';
import { PLAYLIST_STATIONS, Station, StationId } from './playlist-stations';

/** The lists the playlist can play: a station, or the hearted tracks. */
export type PlaylistSource = StationId | 'favorites';

/** Which list plays, a station or the hearted tracks, and keeps the player on it
 *  as favourites come and go. One for the whole app, beside the player. */
@Injectable({ providedIn: 'root' })
export class PlaylistLibrary {
  private readonly player = inject(PlaylistPlayer);
  private readonly favorites = inject(FavoritesStore);
  readonly stations: readonly Station[] = inject(PLAYLIST_STATIONS);
  private readonly chosen = signal<PlaylistSource>(this.stations[0].id);
  private readonly lastStation = signal<StationId>(this.stations[0].id);

  readonly source: Signal<PlaylistSource> = this.chosen.asReadonly();
  /** The station chosen last, which Favourites hands back to. */
  readonly station: Signal<StationId> = this.lastStation.asReadonly();
  readonly hasFavorites = computed(() => this.favorites.count() > 0);

  constructor() {
    // Hearting or un-hearting while Favourites plays changes the list under the
    // player; the last one going hands the music back to the station.
    effect(() => {
      const tracks = this.favorites.tracks();
      untracked(() => {
        if (this.chosen() !== 'favorites') return;
        if (tracks.length === 0) this.choose(this.lastStation());
        else this.player.refreshTracks(tracks);
      });
    });
  }

  choose(source: PlaylistSource): void {
    if (source === this.chosen()) return;
    if (source === 'favorites') return this.playFavorites();
    const station = this.stations.find((each) => each.id === source);
    if (!station) return;
    this.chosen.set(source);
    this.lastStation.set(source);
    this.player.useTracks(station.tracks);
  }

  /** Favourites on, or off again back to the station. */
  toggleFavorites(): void {
    this.choose(this.chosen() === 'favorites' ? this.lastStation() : 'favorites');
  }

  private playFavorites(): void {
    if (!this.hasFavorites()) return;
    this.chosen.set('favorites');
    this.player.useTracks(this.favorites.tracks());
  }
}
