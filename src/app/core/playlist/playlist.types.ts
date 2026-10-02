export type Genre = 'trance' | 'techno';

/** One entry in a playlist: a YouTube video and the words the bar shows for it. */
export interface Track {
  readonly videoId: string;
  readonly title: string;
  readonly artist: string;
  readonly genre: Genre;
}

/** Where the playlist is: never started, waiting on the player, or sounding or held. */
export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused';
