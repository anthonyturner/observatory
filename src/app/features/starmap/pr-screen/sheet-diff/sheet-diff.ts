import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { DiffFile, DiffLine, diffFilesOf, diffLinesOf } from '../../../../core/queue/diff-files';

const BYTES_PER_KB = 1024;

/** The diff split by file, each drawn only when opened: a large pull request is
 *  thousands of lines, and most are never read. */
@Component({
  selector: 'app-sheet-diff',
  templateUrl: './sheet-diff.html',
  styleUrl: './sheet-diff.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetDiff {
  readonly diff = input.required<string>();
  readonly diffBytes = input.required<number>();
  readonly truncated = input.required<boolean>();
  /** The preview withholds a private repository's code. */
  readonly codeHidden = input(false);

  protected readonly files = computed(() => diffFilesOf(this.diff()));
  protected readonly sizeKb = computed(() => Math.round(this.diffBytes() / BYTES_PER_KB));
  /** Each opened file's lines, kept once drawn; a new diff starts all closed. */
  protected readonly opened = linkedSignal<readonly DiffFile[], ReadonlyMap<DiffFile, DiffLine[]>>({
    source: this.files,
    computation: () => new Map(),
  });
  /** Files closed again after being opened: their lines stay drawn, hidden. */
  protected readonly closed = linkedSignal<readonly DiffFile[], ReadonlySet<DiffFile>>({
    source: this.files,
    computation: () => new Set(),
  });
  protected readonly views = computed(() =>
    this.files().map((file) => {
      const lines = this.opened().get(file) ?? null;
      return { file, lines, expanded: lines !== null && !this.closed().has(file) };
    }),
  );

  protected toggle(file: DiffFile): void {
    if (!this.opened().has(file)) {
      this.opened.update((map) => new Map(map).set(file, diffLinesOf(file)));
      return;
    }
    this.closed.update((set) => {
      const next = new Set(set);
      if (!next.delete(file)) next.add(file);
      return next;
    });
  }
}
