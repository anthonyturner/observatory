import { MicRecording } from './microphone';

/** A press shorter than this is a tap: it starts recording, and the next
 *  press stops it, for anyone who cannot hold a key or a touch. */
export const TAP_MS = 300;

/** Held (the mic or M, let go to send) or toggled (Space or Enter on the
 *  mic, which cannot be held the way M can). */
export type PressKind = 'hold' | 'toggle';

/** One turn at the mic, from the press to the transcript. */
export class TalkSession {
  /** `tap` ends at the next press; `hold` when let go. */
  mode: 'tap' | 'hold';
  isReleased: boolean;
  heldForMs = 0;
  recording: MicRecording | null = null;
  isRecording = false;
  limit: ReturnType<typeof setTimeout> | undefined;
  stopMeter: () => void = () => undefined;

  constructor(
    readonly how: PressKind,
    private readonly pressedAt: number,
  ) {
    this.mode = how === 'toggle' ? 'tap' : 'hold';
    this.isReleased = how === 'toggle';
  }

  release(now: number): void {
    this.isReleased = true;
    this.heldForMs = now - this.pressedAt;
  }

  /** Held and let go while the browser was still asking for the microphone:
   *  those words went unheard. */
  wasHeldThroughPrompt(): boolean {
    return this.isReleased && this.how !== 'toggle' && this.heldForMs >= TAP_MS;
  }

  /** Recorded and now turning into text, past the point Esc can throw away. */
  isTranscribing(): boolean {
    return this.recording !== null && !this.isRecording;
  }
}
