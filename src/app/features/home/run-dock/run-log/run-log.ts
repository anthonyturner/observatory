import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranscriptEntry } from '../../../../core/runs/transcript/transcript.types';
import { RunTranscript } from '../run-transcript/run-transcript';

/** Closer than this to the bottom counts as at the end. */
const AT_END_PX = 24;

/** The run's output, scrolling on its own. It keeps to its end while the
 *  viewer is there, and offers Jump to latest once they have scrolled up to
 *  read: it never pulls them away. */
@Component({
  selector: 'app-run-log',
  imports: [RunTranscript],
  templateUrl: './run-log.html',
  styleUrl: './run-log.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunLog {
  readonly entries = input.required<readonly TranscriptEntry[]>();

  protected readonly hasNewer = signal(false);
  private readonly log = viewChild.required<ElementRef<HTMLElement>>('log');
  private isAtEnd = true;

  constructor() {
    afterRenderEffect(() => {
      this.entries();
      untracked(() => this.follow());
    });
  }

  protected onScroll(): void {
    const log = this.log().nativeElement;
    this.isAtEnd = log.scrollHeight - log.scrollTop - log.clientHeight < AT_END_PX;
    if (this.isAtEnd) this.hasNewer.set(false);
  }

  protected jumpToLatest(): void {
    this.isAtEnd = true;
    this.hasNewer.set(false);
    this.toEnd();
    this.log().nativeElement.focus();
  }

  private follow(): void {
    if (this.isAtEnd) this.toEnd();
    else this.hasNewer.set(true);
  }

  private toEnd(): void {
    const log = this.log().nativeElement;
    log.scrollTop = log.scrollHeight;
  }
}
