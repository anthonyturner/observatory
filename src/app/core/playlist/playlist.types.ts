/** What a video is: a music genre, or the tech topic a talk or tutorial covers. */
export type Genre = 'trance' | 'techno' | 'ai' | 'git' | 'learn';

export const GENRES: readonly Genre[] = ['trance', 'techno', 'ai', 'git', 'learn'];

/** One entry in a playlist: a YouTube video and the words the bar shows for it. */
export interface Track {
  readonly videoId: string;
  readonly title: string;
  readonly artist: string;
  readonly genre: Genre;
}

/** Where the playlist is: never started, waiting on the player, or sounding or held. */
export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused';
