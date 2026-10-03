import { Injectable, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { FavoritesStore } from './favorites-store';
import { PLAYLIST_TRACKS, PlaylistPlayer } from './playlist-player';

/** The lists the playlist can play. */
export type PlaylistSource = 'mix' | 'favorites';

/** Which list plays, the day's mix or the hearted tracks, and keeps the player on
 *  it as favourites come and go. One for the whole app, beside the player. */
@Injectable({ providedIn: 'root' })
export class PlaylistLibrary {
  private readonly player = inject(PlaylistPlayer);
  private readonly favorites = inject(FavoritesStore);
  private readonly mix = inject(PLAYLIST_TRACKS);
  private readonly chosen = signal<PlaylistSource>('mix');

  readonly source: Signal<PlaylistSource> = this.chosen.asReadonly();
  readonly hasFavorites = computed(() => this.favorites.count() > 0);

  constructor() {
    // Hearting or un-hearting while Favourites plays changes the list under the
    // player; the last one going hands the music back to the mix.
    effect(() => {
      const tracks = this.favorites.tracks();
      untracked(() => {
        if (this.chosen() !== 'favorites') return;
        if (tracks.length === 0) this.choose('mix');
        else this.player.refreshTracks(tracks);
      });
    });
  }

  choose(source: PlaylistSource): void {
    if (source === this.chosen()) return;
    if (source === 'favorites' && !this.hasFavorites()) return;
    this.chosen.set(source);
    this.player.useTracks(source === 'mix' ? this.mix : this.favorites.tracks());
  }
}
