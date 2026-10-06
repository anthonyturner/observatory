/** Where a capture's sound goes, for as long as it is listened to. */
export interface PcmListener {
  /** Each piece of sound as it comes: 32-bit float frames, little-endian, interleaved. */
  readonly data: (chunk: Uint8Array) => void;
  /** Called once if the capture stops of its own accord; with why, when it failed. */
  readonly ended: (problem: string | null) => void;
}

/** What a starting capture reports: that it is running, then its sound, then its end. */
export interface PcmEvents extends PcmListener {
  readonly started: () => void;
}

/** Starts capturing, telling `events` what happens; returns the way to stop. */
export type PcmSource = (events: PcmEvents) => () => void;

/** The sound a capture sends, which the page needs to play it back at the right speed. */
export interface PcmFormat {
  readonly sampleRate: number;
  readonly channels: number;
}
