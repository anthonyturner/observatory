import { TestBed } from '@angular/core/testing';
import { FavoritesStore } from './favorites-store';
import { PlaylistLibrary } from './playlist-library';
import { PlaylistPlayer } from './playlist-player';
import { PLAYLIST_STATIONS, Station } from './playlist-stations';
import { Track } from './playlist.types';
import { VIDEO_PLAYER_FACTORY, VideoPlayer } from './video-player';

const track = (id: string): Track => ({
  videoId: id.repeat(11),
  title: `Track ${id}`,
  artist: 'Artist',
  genre: 'trance',
});
const MIX = [track('a'), track('b'), track('c')];
const TALKS = [track('d'), track('e')];
const LIKED = track('x');
const STATIONS: Station[] = [
  { id: 'music', label: 'Music', tracks: MIX },
  { id: 'ai', label: 'AI', tracks: TALKS },
];

function setup() {
  const video: VideoPlayer = {
    load: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    setVolume: vi.fn(),
    seekTo: vi.fn(),
    currentTime: () => 0,
    duration: () => 0,
    dispose: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      PlaylistPlayer,
      PlaylistLibrary,
      { provide: PLAYLIST_STATIONS, useValue: STATIONS },
      { provide: VIDEO_PLAYER_FACTORY, useValue: () => Promise.resolve(video) },
    ],
  });
  return {
    library: TestBed.inject(PlaylistLibrary),
    player: TestBed.inject(PlaylistPlayer),
    favorites: TestBed.inject(FavoritesStore),
  };
}

describe('PlaylistLibrary', () => {
  beforeEach(() => localStorage.clear());

  it('opens on the first station', () => {
    const { library, player } = setup();
    expect(library.source()).toBe('music');
    expect(player.tracks()).toBe(MIX);
  });

  it('switches the player to another station from its top', () => {
    const { library, player } = setup();
    player.select(2);
    library.choose('ai');
    expect(library.source()).toBe('ai');
    expect(library.station()).toBe('ai');
    expect(player.tracks()).toBe(TALKS);
    expect(player.index()).toBe(0);
  });

  it('stays on the station while there are no favourites', () => {
    const { library, player } = setup();
    library.choose('favorites');
    expect(library.source()).toBe('music');
    expect(player.tracks()).toBe(MIX);
  });

  it('switches the player to the favourites from their top, and back to the station', () => {
    const { library, player, favorites } = setup();
    favorites.toggle(MIX[1]);
    favorites.toggle(LIKED);
    player.select(2);

    library.choose('favorites');
    expect(player.tracks()).toEqual([MIX[1], LIKED]);
    expect(player.index()).toBe(0);

    library.choose('music');
    expect(player.tracks()).toBe(MIX);
  });

  it('toggles Favourites back to the station chosen last', () => {
    const { library, player, favorites } = setup();
    favorites.toggle(LIKED);
    library.choose('ai');
    library.toggleFavorites();
    expect(library.source()).toBe('favorites');
    expect(library.station()).toBe('ai');

    library.toggleFavorites();
    expect(library.source()).toBe('ai');
    expect(player.tracks()).toBe(TALKS);
  });

  it('follows hearts added while the favourites play', () => {
    const { library, player, favorites } = setup();
    favorites.toggle(LIKED);
    library.choose('favorites');
    favorites.toggle(MIX[0]);
    TestBed.tick();
    expect(player.tracks()).toEqual([LIKED, MIX[0]]);
    expect(player.current()).toEqual(LIKED);
  });

  it('hands the music back to the station when the last favourite goes', () => {
    const { library, player, favorites } = setup();
    favorites.toggle(LIKED);
    library.choose('ai');
    library.choose('favorites');
    favorites.toggle(LIKED);
    TestBed.tick();
    expect(library.source()).toBe('ai');
    expect(player.tracks()).toBe(TALKS);
  });
});
