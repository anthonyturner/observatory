import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { LogFilter } from '../../../core/logs/log-levels';
import { LogFault, LogSnapshot } from '../../../core/logs/log-snapshot';
import {
  METEOR_HEIGHT,
  dayAt,
  meteorCaption,
  meteorDays,
  meteorGeometry,
  meteorTip,
  tipLeft,
} from '../../../core/logs/meteor-record';
import { MeteorPalette, paintMeteors, readMeteorPalette } from './meteor-painter';

const MAX_PIXEL_RATIO = 2;

/** Errors and warnings per day along the bottom of the Log Sky. Hover a day
 *  for its counts; a traced fault's lifetime is shaded behind the streaks. */
@Component({
  selector: 'app-meteor-record',
  templateUrl: './meteor-record.html',
  styleUrl: './meteor-record.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[hidden]': '!days().length',
    '(window:resize)': 'onResize()',
  },
})
export class MeteorRecord {
  readonly snapshot = input.required<LogSnapshot>();
  readonly filter = input<LogFilter>(null);
  /** The fault whose threads are drawn: its first to last day is shaded. */
  readonly traced = input<LogFault | null>(null);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly window = inject(DOCUMENT).defaultView;
  /** Bumped on resize, so the strip is drawn again at its new width. */
  private readonly resized = signal(0);
  private palette: MeteorPalette | null = null;
  protected readonly days = computed(() => meteorDays(this.snapshot()));
  protected readonly caption = computed(() => meteorCaption(this.days(), this.filter()));
  protected readonly tip = signal<{ readonly text: string; readonly left: number } | null>(null);

  constructor() {
    afterRenderEffect(() => {
      this.resized();
      this.draw(this.canvas().nativeElement);
    });
  }

  protected onResize(): void {
    this.resized.update((count) => count + 1);
  }

  protected onPointerMove(event: PointerEvent): void {
    const box = this.canvas().nativeElement.getBoundingClientRect();
    const x = event.clientX - box.left;
    const day = dayAt(this.days(), x, box.width);
    this.tip.set(day ? { text: meteorTip(day), left: tipLeft(x, box.width) } : null);
  }

  private draw(canvas: HTMLCanvasElement): void {
    const width = canvas.clientWidth;
    const context = canvas.getContext('2d');
    if (!width || !context || !this.days().length) return;
    const ratio = Math.min(this.window?.devicePixelRatio ?? 1, MAX_PIXEL_RATIO);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(METEOR_HEIGHT * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.palette ??= readMeteorPalette(canvas);
    const traced = this.traced();
    paintMeteors(context, meteorGeometry(this.days(), { width, filter: this.filter(), traced }), {
      palette: this.palette,
      tracedLevel: traced?.level ?? null,
    });
  }
}
