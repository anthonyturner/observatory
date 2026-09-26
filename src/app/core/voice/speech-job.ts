import { SpeakerLine } from './speaker-output';
import { SpokenClip } from './voice-protocol';
import { within } from './within';

/** The earliest a sentence starts from now, so its start is never past. */
const START_GAP_S = 0.02;
/** Cut off, a reply fades this fast (a time constant) so it does not click… */
const FADE_S = 0.012;
/** …and its sentences stop once the fade has all but finished. */
const STOP_AFTER_S = 0.06;
const DISCONNECT_MS = 200;
/** How long past a reply's scheduled end to wait to hear it finish. Output
 *  that never starts (a browser that has not let the page play sound) must
 *  not keep the reply speaking forever. */
const PLAY_SLACK_MS = 2000;

/** One reply's sound: sentences played back to back into one output, each
 *  made while the one before it plays. */
export class SpeechJob {
  private readonly sources = new Set<AudioBufferSourceNode>();
  private readonly gain: GainNode;
  private endsAt = 0;
  private hasSounded = false;
  private isStopped = false;
  private whenQuiet: () => void = () => undefined;

  constructor(
    private readonly line: SpeakerLine,
    private readonly onFirstSound: () => void,
  ) {
    this.gain = line.context.createGain();
    this.gain.connect(line.input);
  }

  /** Queues `clip` straight after the one before it. */
  play(clip: SpokenClip): void {
    const { context } = this.line;
    const buffer = context.createBuffer(1, clip.audio.length, clip.rate);
    buffer.copyToChannel(clip.audio, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain);
    const at = Math.max(context.currentTime + START_GAP_S, this.endsAt);
    source.start(at);
    this.endsAt = at + buffer.duration;
    this.sources.add(source);
    source.onended = () => this.ended(source);
    if (!this.hasSounded) {
      this.hasSounded = true;
      this.onFirstSound();
    }
  }

  /** Settles once every sentence queued has been heard; fails with `audio`
   *  when the output never plays them. */
  heard(): Promise<void> {
    const quiet = new Promise<void>((resolve) => {
      this.whenQuiet = resolve;
      if (!this.sources.size) resolve();
    });
    const remainingS = Math.max(0, this.endsAt - this.line.context.currentTime);
    return within(quiet, remainingS * 1000 + PLAY_SLACK_MS, 'audio');
  }

  /** Stops within a few hundredths of a second. Safe to repeat. */
  stop(): void {
    if (this.isStopped) return;
    this.isStopped = true;
    const now = this.line.context.currentTime;
    this.gain.gain.setTargetAtTime(0, now, FADE_S);
    this.sources.forEach((source) => source.stop(now + STOP_AFTER_S));
    this.sources.clear();
    setTimeout(() => this.gain.disconnect(), DISCONNECT_MS);
    this.whenQuiet();
  }

  private ended(source: AudioBufferSourceNode): void {
    this.sources.delete(source);
    if (!this.sources.size) this.whenQuiet();
  }
}
