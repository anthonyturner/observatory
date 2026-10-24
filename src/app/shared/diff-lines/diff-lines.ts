import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { DiffLine } from '../../core/queue/diff-files';
import { DiffWrapChoice } from '../../core/queue/diff-wrap-choice';

/** Past this many lines, the browser lays out only the ones near the window: a 1 MB file is
 *  about 20,000 lines, and drawing them all took twice as long (measured in headless Edge). */
const LONG_FILE_LINES = 2000;

/**
 * Lines of code as a diff draws them: an old and a new number, a sign, and the code, with
 * added and removed lines washed in colour and the words that changed marked. Long lines
 * wrap or scroll sideways as the one choice for every diff says.
 */
@Component({
  selector: 'app-diff-lines',
  templateUrl: './diff-lines.html',
  styleUrl: './diff-lines.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.wrap]': 'wraps()', '[class.long]': 'isLong()' },
})
export class DiffLines {
  readonly lines = input.required<readonly DiffLine[]>();
  /** The index of a line to bring to the middle of the window, each time it changes. */
  readonly reveal = input<number | null>(null);

  protected readonly wraps = inject(DiffWrapChoice).wraps;
  protected readonly isLong = computed(() => this.lines().length > LONG_FILE_LINES);
  private readonly code = viewChild.required<ElementRef<HTMLElement>>('code');

  constructor() {
    afterRenderEffect(() => {
      const index = this.reveal();
      this.lines();
      if (index !== null)
        this.code().nativeElement.children[index]?.scrollIntoView({ block: 'center' });
    });
  }
}
