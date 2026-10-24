/**
 * The shortest wait between two frames of ambient drift, in seconds. Drift is
 * slow, so about 30 frames a second reads the same as the display's own rate.
 * A hair under a 30th, so a 60 Hz display (two refreshes, 33.3 ms, give or take
 * a millisecond of jitter) still lands on 30 rather than falling to 20.
 */
const AMBIENT_GAP = 0.03;

/**
 * Decides which animation frames the sky draws. A frame the viewer is driving
 * (a drag, the camera easing, a burst playing) always draws; a frame that only
 * carries ambient drift waits for the next slot.
 */
export class FramePace {
  private drawnAt = -Infinity;

  /** Forgets the last frame, so the next one draws at once. */
  restart(): void {
    this.drawnAt = -Infinity;
  }

  /** Whether to draw at `now` (seconds); says yes and counts the frame if so. */
  take(now: number, interacting: boolean): boolean {
    if (!interacting && now - this.drawnAt < AMBIENT_GAP) return false;
    this.drawnAt = now;
    return true;
  }
}
