/** The browser's frame clock, behind an interface so a test can drive it. */
export interface FrameScheduler {
  request(callback: (ms: number) => void): void;
  isHidden(): boolean;
  nowMs(): number;
}

export interface FrameLoopOptions {
  readonly scheduler: FrameScheduler;
  /** Draws one frame at scene time `time` and real time `wall`, both in seconds. */
  readonly draw: (time: number, wall: number) => void;
  readonly framesPerSecond: () => number;
  readonly isStill: () => boolean;
  /** Told of the first frame that throws; later ones are not repeated. */
  readonly onError: (error: unknown) => void;
}

/** A still core is drawn at this moment of the scene: one whose pose reads well. */
export const STILL_TIME = 9.4;
/** A long pause (a background tab, a debugger) moves the scene on by at most this. */
const MAX_STEP_S = 0.1;
/** A frame this early still counts as on time, so a 30 fps budget on a 60 Hz display is not 20. */
const FRAME_SLACK_S = 0.004;

/** Draws frames within a budget, one frame per change when still, and none
 *  while the page is hidden. `kick` after anything that changes the picture. */
export class FrameLoop {
  private sceneTime = 0;
  private lastFrame = 0;
  private lastDraw = 0;
  private isRunning = false;
  private isStopped = false;
  private hasFailed = false;

  constructor(private readonly options: FrameLoopOptions) {}

  kick(): void {
    if (this.isRunning || this.isStopped) return;
    this.isRunning = true;
    this.lastFrame = this.options.scheduler.nowMs() / 1000;
    this.options.scheduler.request((ms) => this.tick(ms));
  }

  stop(): void {
    this.isStopped = true;
  }

  private tick(ms: number): void {
    const { scheduler, isStill, framesPerSecond } = this.options;
    if (this.isStopped || scheduler.isHidden()) {
      this.isRunning = false;
      return;
    }
    const wall = ms / 1000;
    const still = isStill();
    if (still || wall - this.lastDraw >= 1 / framesPerSecond() - FRAME_SLACK_S) {
      this.drawAt(wall, still);
      this.lastDraw = wall;
    }
    if (still) {
      this.isRunning = false;
      return;
    }
    scheduler.request((next) => this.tick(next));
  }

  /** A frame that throws must not end the loop, or every later kick would
   *  find it running and the core would stop for good. */
  private drawAt(wall: number, still: boolean): void {
    const step = Math.min(Math.max(wall - this.lastFrame, 0), MAX_STEP_S);
    this.lastFrame = wall;
    if (!still) this.sceneTime += step;
    try {
      this.options.draw(still ? STILL_TIME : this.sceneTime, wall);
    } catch (error: unknown) {
      if (!this.hasFailed) this.options.onError(error);
      this.hasFailed = true;
    }
  }
}
