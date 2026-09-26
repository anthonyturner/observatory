import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Frame } from '../../../../core/queue/history-report';
import { LedgerRow } from '../../../../core/queue/ledger';
import {
  TIMELINE_HEIGHT,
  TimelineScale,
  frameAtX,
  paintTimeline,
  timelineCaption,
  timelineScale,
  timelineTip,
} from './timeline-painter';

const MAX_PIXEL_RATIO = 2;
/** A tip stays this far from each end, so it never runs off the strip. */
const TIP_MARGIN = 170;

/**
 * pr-starmap's timeline under the review queue: sixty days of the ledger to
 * read, and every recorded refresh to drag to. Replay steps through them;
 * Live returns.
 */
@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.html',
  styleUrl: './timeline.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Timeline {
  readonly rows = input.required<readonly LedgerRow[]>();
  readonly frames = input.required<readonly Frame[]>();
  readonly lastSeen = input<string | null>(null);
  readonly replayAt = input<string | null>(null);
  readonly playing = input(false);
  /** A frame to show, or null for now. */
  readonly scrub = output<number | null>();
  readonly replay = output<void>();
  readonly live = output<void>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly window = inject(DOCUMENT).defaultView;
  private scale: TimelineScale | null = null;
  private scrubbing = false;

  protected readonly tip = signal<{ text: string; left: number } | null>(null);
  protected readonly caption = computed(() => timelineCaption(this.rows(), this.frames()));
  protected readonly canReplay = computed(() => this.frames().length >= 2);
  protected readonly replayTitle = computed(() =>
    this.canReplay()
      ? 'Replay every recorded refresh, oldest first ( [ and ] step )'
      : 'Replay needs at least two recorded refreshes',
  );

  constructor() {
    afterRenderEffect(() => this.draw());
  }

  protected onPointerDown(event: PointerEvent): void {
    this.scrubbing = true;
    this.canvas().nativeElement.setPointerCapture?.(event.pointerId);
    this.scrubTo(event);
  }

  protected onPointerUp(): void {
    this.scrubbing = false;
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.scrubbing) this.scrubTo(event);
    if (!this.scale) return;
    const box = this.canvas().nativeElement.getBoundingClientRect();
    const i = Math.floor(((event.clientX - box.left) / box.width) * this.scale.rows.length);
    const row = this.scale.rows[i];
    if (!row) return this.tip.set(null);
    const x = event.clientX - box.left;
    this.tip.set({
      text: timelineTip(row),
      left: Math.min(Math.max(x, TIP_MARGIN), box.width - TIP_MARGIN),
    });
  }

  private scrubTo(event: PointerEvent): void {
    if (!this.scale) return;
    const box = this.canvas().nativeElement.getBoundingClientRect();
    const index = frameAtX(this.scale, this.frames(), event.clientX - box.left);
    if (index === undefined) return;
    this.scrub.emit(index);
  }

  private draw(): void {
    const rows = this.rows();
    const frames = this.frames();
    const lastSeen = this.lastSeen();
    const replayAt = this.replayAt();
    const canvas = this.canvas().nativeElement;
    const c = canvas.getContext('2d');
    if (!c || rows.length < 2) return;
    const ratio = Math.min(this.window?.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const w = canvas.clientWidth;
    canvas.width = Math.floor(w * ratio);
    canvas.height = Math.floor(TIMELINE_HEIGHT * ratio);
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.clearRect(0, 0, w, TIMELINE_HEIGHT);
    this.scale = timelineScale(rows, w);
    paintTimeline(c, this.scale, frames, lastSeen, replayAt);
  }
}
