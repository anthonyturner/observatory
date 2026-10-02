import { InjectionToken } from '@angular/core';
import { createYouTubePlayer } from './youtube-player';

/** A video player the playlist drives, in the playlist's own words. */
export interface VideoPlayer {
  load(videoId: string): void;
  play(): void;
  pause(): void;
  /** From 0 to 1. */
  setVolume(volume: number): void;
  dispose(): void;
}

/** What the player reports back as a video plays. */
export interface VideoPlayerEvents {
  playing(): void;
  paused(): void;
  ended(): void;
  /** The video will not play here: removed, private or not embeddable. */
  failed(): void;
}

export interface VideoPlayerOptions {
  /** The element the player draws inside; it must stay on the page while it plays. */
  readonly host: HTMLElement;
  readonly videoId: string;
  readonly volume: number;
  readonly events: VideoPlayerEvents;
}

export type VideoPlayerFactory = (options: VideoPlayerOptions) => Promise<VideoPlayer>;

/** Makes the player a playlist plays through; YouTube's embedded player by default. */
export const VIDEO_PLAYER_FACTORY = new InjectionToken<VideoPlayerFactory>('VIDEO_PLAYER_FACTORY', {
  providedIn: 'root',
  factory: () => createYouTubePlayer,
});
