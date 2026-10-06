import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { PullDetail } from '../../../../core/queue/pull-detail';
import { newCommitsText } from '../../../../core/queue/since-look';
import { SinceLookFeed } from '../../../../core/queue/since-look-feed';
import { pullDiffKey, sinceLookDiffKey } from '../../../../core/queue/viewed-files';
import { SheetDiff } from '../sheet-diff/sheet-diff';
import { diffShown, hasMovedSince } from './diff-shown';

/** The two heads to compare, while the head has moved past the one looked at. */
interface Range {
  readonly base: string;
  readonly head: string;
}

const sameRange = (a: Range | null, b: Range | null): boolean =>
  a === b || (a !== null && b !== null && a.base === b.base && a.head === b.head);

/** The Diff tab: the whole pull request's diff, or with Since last look just
 *  what changed after the head it was last looked at. */
@Component({
  selector: 'app-sheet-diff-tab',
  imports: [SheetDiff],
  providers: [SinceLookFeed],
  templateUrl: './sheet-diff-tab.html',
  styleUrl: './sheet-diff-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetDiffTab {
  readonly repo = input.required<string>();
  readonly detail = input.required<PullDetail>();
  /** The head when it was last looked at, before this screen opened; null for never. */
  readonly lookedSha = input<string | null>(null);

  private readonly feed = inject(SinceLookFeed);

  private readonly range = computed(
    (): Range | null => {
      const base = this.lookedSha();
      const head = this.detail().headOid;
      return base !== null && hasMovedSince(base, head) ? { base, head } : null;
    },
    { equal: sameRange },
  );
  protected readonly hasMoved = computed(() => this.range() !== null);
  /** On whenever the head has moved, and again each time it moves. */
  protected readonly wantsSince = linkedSignal(() => this.hasMoved());
  protected readonly countText = computed(() => {
    const state = this.feed.state();
    const count = state.status === 'ready' ? state.since.newCommits : null;
    return count === null ? '' : newCommitsText(count);
  });
  protected readonly view = computed(() => {
    const shown = diffShown(this.feed.state(), this.wantsSince());
    const detail = this.detail();
    if (shown.kind === 'since') {
      const { since } = shown;
      return {
        reading: false,
        note: null,
        diff: since.diff,
        diffBytes: since.diffBytes,
        truncated: since.diffTruncated,
        codeHidden: since.diffHidden,
        viewedKey: sinceLookDiffKey(this.repo(), detail.number, since.base, since.head),
      };
    }
    return {
      reading: shown.kind === 'reading',
      note: shown.kind === 'full' ? shown.note : null,
      diff: detail.diff,
      diffBytes: detail.diffBytes,
      truncated: detail.diffTruncated,
      codeHidden: detail.diffHidden,
      viewedKey: pullDiffKey(this.repo(), detail.number),
    };
  });

  constructor() {
    effect(() => {
      const range = this.range();
      if (range) this.feed.load(this.repo(), range.base, range.head);
      else this.feed.clear();
    });
  }

  protected onSinceChange(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.wantsSince.set(event.target.checked);
  }
}
