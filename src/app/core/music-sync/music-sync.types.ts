/** How loud each part of the spectrum is right now, each from 0 to 1. */
export interface BandLevels {
  readonly bass: number;
  readonly mid: number;
  readonly high: number;
}

/** One moment of the music as the sky reads it. */
export interface MusicFrame extends BandLevels {
  /** The three bands together, from 0 to 1. */
  readonly energy: number;
  /** A kick landed on this frame. */
  readonly beat: boolean;
  /** The music surged after a quieter stretch: a drop. */
  readonly drop: boolean;
}

export const SILENCE: MusicFrame = {
  bass: 0,
  mid: 0,
  high: 0,
  energy: 0,
  beat: false,
  drop: false,
};

/** Whether the sky is listening to the tab, and if not, why not. */
export type SyncStatus = 'off' | 'asking' | 'listening' | 'no-audio' | 'denied' | 'unsupported';
