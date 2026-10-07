import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { DiffFile, DiffLine, diffFilesOf, diffLinesOf } from '../../../../core/queue/diff-files';
import { SeenFile, ViewedFiles, seenFileOf } from '../../../../core/queue/viewed-files';

const BYTES_PER_KB = 1024;

/** What the notes say about a diff too large to carry, or cut to fit: where the rest is. */
export interface SheetDiffWording {
  /** After "This diff is too large to carry here (N KB)." */
  readonly tooLarge: string;
  readonly cutShort: string;
}

/** A pull request's: GitHub has the whole diff. */
export const GITHUB_DIFF_WORDING: SheetDiffWording = {
  tooLarge: 'Open it on GitHub.',
  cutShort: 'Shortened to fit — the full diff is on GitHub. Files near the end may be missing.',
};

interface FileEntry {
  readonly file: DiffFile;
  readonly seen: SeenFile;
}

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
  /** Names this diff for its viewed ticks: a pull request's, or one commit's. */
  readonly viewedKey = input.required<string>();
  /** The preview withholds a private repository's code. */
  readonly codeHidden = input(false);
  readonly wording = input<SheetDiffWording>(GITHUB_DIFF_WORDING);

  private readonly viewedFiles = inject(ViewedFiles);

  protected readonly files = computed((): readonly FileEntry[] =>
    diffFilesOf(this.diff()).map((file) => ({ file, seen: seenFileOf(file) })),
  );
  protected readonly sizeKb = computed(() => Math.round(this.diffBytes() / BYTES_PER_KB));
  /** Each opened file's lines, kept once drawn; a new diff starts all closed. */
  protected readonly opened = linkedSignal<readonly FileEntry[], ReadonlyMap<DiffFile, DiffLine[]>>(
    {
      source: this.files,
      computation: () => new Map(),
    },
  );
  /** Files closed again after being opened: their lines stay drawn, hidden. */
  protected readonly closed = linkedSignal<readonly FileEntry[], ReadonlySet<DiffFile>>({
    source: this.files,
    computation: () => new Set(),
  });
  protected readonly views = computed(() =>
    this.files().map(({ file, seen }) => {
      const lines = this.opened().get(file) ?? null;
      return {
        file,
        seen,
        lines,
        expanded: lines !== null && !this.closed().has(file),
        viewed: this.viewedFiles.isViewed(this.viewedKey(), seen),
      };
    }),
  );
  protected readonly viewedCount = computed(
    () => this.views().filter((view) => view.viewed).length,
  );

  /** Opening a file to read it ticks it as viewed; closing it leaves the tick. */
  protected toggle({ file, seen }: FileEntry): void {
    if (this.isExpanded(file)) {
      this.collapse(file);
      return;
    }
    this.expand(file);
    this.viewedFiles.mark(this.viewedKey(), seen);
  }

  /** The tick only marks the file: opening and closing stay with its header. */
  protected onViewedChange(event: Event, { seen }: FileEntry): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (event.target.checked) this.viewedFiles.mark(this.viewedKey(), seen);
    else this.viewedFiles.unmark(this.viewedKey(), seen.path);
  }

  private isExpanded(file: DiffFile): boolean {
    return this.opened().has(file) && !this.closed().has(file);
  }

  private expand(file: DiffFile): void {
    if (!this.opened().has(file)) {
      this.opened.update((map) => new Map(map).set(file, diffLinesOf(file)));
    }
    this.closed.update((set) => withoutItem(set, file));
  }

  private collapse(file: DiffFile): void {
    if (this.opened().has(file)) this.closed.update((set) => new Set(set).add(file));
  }
}

function withoutItem<T>(set: ReadonlySet<T>, item: T): ReadonlySet<T> {
  if (!set.has(item)) return set;
  const next = new Set(set);
  next.delete(item);
  return next;
}
