import {
  ChangeDetectionStrategy,
  Component,
  ErrorHandler,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AskBoxFocus } from '../../../core/assistant/ask-box-focus';
import { AssistantInfo } from '../../../core/assistant/assistant-info';
import { CoreGeometry, beadAt } from '../../../core/instrument/core-geometry';
import { CoreHand } from '../../../core/instrument/core-hand';
import { NudgeDirection, PointerKind, PointerSample } from '../../../core/instrument/hand';
import { BALL, TIER_RING } from '../../../core/instrument/proportions';
import { LitProject } from '../../../core/projects/lit-project';
import { ProjectJump } from '../../../core/projects/project-jump';
import { MICROPHONE } from '../../../core/voice/microphone';
import { PushToTalk } from '../../../core/voice/push-to-talk';

/** What a press of the core does: talk where voice can run, go to the ask box
 *  where it cannot, and nothing where there is no assistant (the hosted
 *  preview), where it is only a ball to turn. As on pr-starmap. */
export type CorePress = 'talk' | 'ask' | 'turn';

const PRESS_WORDS: Readonly<Record<CorePress, { name: string; title: string; hint: string }>> = {
  talk: {
    name: 'Talk to Home',
    title: 'Click to talk · drag to turn',
    hint: "Press to start talking and again to stop. Drag it, or use the arrow keys, to turn the core. Point at a project's bead to name it, and click it to go to its card.",
  },
  ask: {
    name: 'Ask Home',
    title: 'Click to ask · drag to turn',
    hint: "Press to type a request; voice cannot run in this browser. Drag it, or use the arrow keys, to turn the core. Point at a project's bead to name it, and click it to go to its card.",
  },
  turn: {
    name: 'Core',
    title: 'Drag to turn',
    hint: "Drag it, or use the arrow keys, to turn it. Point at a project's bead to name it, and click it to go to its card.",
  },
};

const ARROWS: Readonly<Record<string, NudgeDirection>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

/** The one place the core takes the pointer: a circle over the ball and its
 *  ring, so everywhere else the page scrolls and clicks as it did. A drag on
 *  it turns the ball instead of scrolling the page, touch included; pointing
 *  at a project's bead lights it; the arrow keys turn the ball. A press that
 *  does not drag, off every bead, talks, as the mic does. */
@Component({
  selector: 'app-core-touch',
  template: `<button
      type="button"
      class="surface"
      [class.held]="isHeld()"
      [class.on-bead]="isOnBead()"
      [attr.aria-label]="words().name"
      [attr.aria-pressed]="presses() === 'talk' ? talk.isRecording() : null"
      aria-describedby="core-touch-hint"
      [title]="words().title"
      (pointerdown)="press($event)"
      (pointermove)="move($event)"
      (pointerup)="letGo($event)"
      (pointercancel)="letGo($event)"
      (lostpointercapture)="letGo($event)"
      (pointerleave)="leave()"
      (keydown)="nudge($event)"
      (click)="jump($event)"
    ></button>
    <span class="visually-hidden" id="core-touch-hint">{{ words().hint }}</span>`,
  styleUrl: './core-touch.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--reach.px]': 'reachPx()' },
})
export class CoreTouch {
  private readonly geometry = inject(CoreGeometry);
  private readonly hand = inject(CoreHand);
  private readonly lit = inject(LitProject);
  private readonly projectJump = inject(ProjectJump);
  private readonly assistant = inject(AssistantInfo);
  private readonly mic = inject(MICROPHONE);
  private readonly askBox = inject(AskBoxFocus);
  private readonly errors = inject(ErrorHandler);
  protected readonly talk = inject(PushToTalk);
  private pointedKey: string | null = null;
  protected readonly isHeld = signal(false);
  protected readonly isOnBead = signal(false);

  protected readonly presses = computed((): CorePress => {
    if (this.assistant.isElsewhere()) return 'turn';
    return this.mic.canRecord() ? 'talk' : 'ask';
  });
  protected readonly words = computed(() => PRESS_WORDS[this.presses()]);

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

  /** A click on a bead goes to its project's card; anywhere else on the core,
   *  or Enter or Space on it, talks (or opens the ask box). A drag does neither. */
  protected jump(event: MouseEvent): void {
    if (this.hand.state.hasDragged) return;
    const isKeyboard = event.detail === 0;
    const key = isKeyboard
      ? null
      : beadAt(this.geometry.placed(), event.clientX, event.clientY)?.key;
    if (key) {
      this.projectJump.jumpTo(key);
      return;
    }
    this.pressCore();
  }

  private pressCore(): void {
    const does = this.presses();
    if (does === 'talk') {
      this.talk.press('toggle').catch((error: unknown) => this.errors.handleError(error));
    } else if (does === 'ask') {
      this.askBox.request();
    }
  }

  private pointAtBead(x: number, y: number): void {
    const key = beadAt(this.geometry.placed(), x, y)?.key ?? null;
    this.isOnBead.set(key !== null);
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
