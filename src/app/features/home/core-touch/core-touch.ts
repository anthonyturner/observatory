import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CoreGeometry, beadAt } from '../../../core/instrument/core-geometry';
import { CoreHand } from '../../../core/instrument/core-hand';
import { NudgeDirection, PointerKind, PointerSample } from '../../../core/instrument/hand';
import { BALL, TIER_RING } from '../../../core/instrument/proportions';
import { LitProject } from '../../../core/projects/lit-project';

const ARROWS: Readonly<Record<string, NudgeDirection>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

/** The one place the core takes the pointer: a circle over the ball and its
 *  ring, so everywhere else the page scrolls and clicks as it did. A drag on
 *  it turns the ball instead of scrolling the page, touch included; pointing
 *  at a project's bead lights it; the arrow keys turn the ball. */
@Component({
  selector: 'app-core-touch',
  template: `<button
      type="button"
      class="surface"
      [class.held]="isHeld()"
      aria-label="Core"
      aria-describedby="core-touch-hint"
      title="Drag to turn"
      (pointerdown)="press($event)"
      (pointermove)="move($event)"
      (pointerup)="letGo($event)"
      (pointercancel)="letGo($event)"
      (lostpointercapture)="letGo($event)"
      (pointerleave)="leave()"
      (keydown)="nudge($event)"
    ></button>
    <span class="visually-hidden" id="core-touch-hint"
      >Drag it, or use the arrow keys, to turn it. Point at a project's bead to name it.</span
    >`,
  styleUrl: './core-touch.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--reach.px]': 'reachPx()' },
})
export class CoreTouch {
  private readonly geometry = inject(CoreGeometry);
  private readonly hand = inject(CoreHand);
  private readonly lit = inject(LitProject);
  private pointedKey: string | null = null;
  protected readonly isHeld = signal(false);

  /** Wide enough to take the beads on the orbit as well as the ball. */
  protected readonly reachPx = computed(() =>
    Math.round((this.geometry.view()?.radius ?? 0) * TIER_RING),
  );

  protected press(event: PointerEvent): void {
    if (event.button !== 0) return;
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    this.isHeld.set(true);
    this.hand.state.press(sampleOf(event));
    this.hand.redraw();
  }

  protected move(event: PointerEvent): void {
    this.hand.state.move(sampleOf(event), this.ballRadius());
    this.pointAtBead(event.clientX, event.clientY);
    this.hand.redraw();
  }

  protected letGo(event: PointerEvent): void {
    this.isHeld.set(false);
    this.hand.state.release(sampleOf(event), this.isOnBall(event));
    this.hand.redraw();
  }

  protected leave(): void {
    this.hand.state.leave();
    this.pointAtBead(Number.NaN, Number.NaN);
    this.hand.redraw();
  }

  protected nudge(event: KeyboardEvent): void {
    const direction = ARROWS[event.key];
    if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    this.hand.state.nudge(direction);
    this.hand.redraw();
  }

  private pointAtBead(x: number, y: number): void {
    const key = beadAt(this.geometry.placed(), x, y)?.key ?? null;
    if (key === this.pointedKey) return;
    if (this.pointedKey) this.lit.unlight(this.pointedKey);
    if (key) this.lit.light(key);
    this.pointedKey = key;
  }

  private ballRadius(): number {
    return (this.geometry.view()?.radius ?? 0) * BALL;
  }

  private isOnBall(event: PointerEvent): boolean {
    const view = this.geometry.view();
    if (!view) return false;
    return (
      Math.hypot(event.clientX - view.centreX, event.clientY - view.centreY) <= this.ballRadius()
    );
  }
}

function sampleOf(event: PointerEvent): PointerSample {
  const kind: PointerKind = event.pointerType === 'mouse' ? 'mouse' : 'other';
  return { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp, kind };
}
