/** How loud each part of the spectrum is right now, each from 0 to 1. */
export interface BandLevels {
  readonly bass: number;
  readonly mid: number;
  readonly high: number;
  /** The kick drum's punch, under most of the bassline. */
  readonly kick: number;
}

/** One moment of the music as the sky reads it. */
export interface MusicFrame extends BandLevels {
  /** The three bands together, from 0 to 1. */
  readonly energy: number;
  /** A beat landed on this frame: a kick, or the tempo's next beat once it is locked. */
  readonly beat: boolean;
  /** 1 on a beat, dying away before the next, for every layer to hit with. */
  readonly pulse: number;
  /** The music surged after a quieter stretch: a drop. */
  readonly drop: boolean;
}

export const SILENCE: MusicFrame = {
  bass: 0,
  mid: 0,
  high: 0,
  kick: 0,
  energy: 0,
  beat: false,
  pulse: 0,
  drop: false,
};

/** Whether the sky is listening to the chosen source, and if not, why not. */
export type SyncStatus = 'off' | 'asking' | 'listening' | 'no-audio' | 'denied' | 'unsupported';
