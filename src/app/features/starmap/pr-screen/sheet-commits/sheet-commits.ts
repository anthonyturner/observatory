import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { CommitDiffFeed } from '../../../../core/queue/commit-diff-feed';
import { PullDetail } from '../../../../core/queue/pull-detail';
import { SheetDiff } from '../sheet-diff/sheet-diff';
import { commitRows, commitsNote } from '../sheet-rows/sheet-row';
import { SheetRows } from '../sheet-rows/sheet-rows';
import { CommitView, commitViewOf } from './commit-view';

/** The Commits tab: each commit opens its own diff beneath it, one at a time. */
@Component({
  selector: 'app-sheet-commits',
  imports: [SheetRows, SheetDiff],
  providers: [CommitDiffFeed],
  templateUrl: './sheet-commits.html',
  styleUrl: './sheet-commits.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetCommits {
  readonly repo = input.required<string>();
  readonly detail = input.required<PullDetail>();

  private readonly feed = inject(CommitDiffFeed);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly rows = computed(() => commitRows(this.detail()));
  protected readonly note = computed(() => commitsNote(this.detail()));
  /** The open commit's full hash; another pull request starts with none open. */
  protected readonly openSha = linkedSignal<string, string | null>({
    source: () => `${this.repo()}#${this.detail().number}`,
    computation: () => null,
  });
  /** None when no commit is open, or a refresh dropped the open one from the list. */
  protected readonly view = computed((): CommitView | null => {
    const sha = this.openSha();
    const { number, commits } = this.detail();
    const commit = commits.find((each) => each.sha === sha);
    return commit ? commitViewOf(this.feed.state(), { repo: this.repo(), number, commit }) : null;
  });

  protected toggle(sha: string): void {
    if (this.openSha() === sha) {
      this.openSha.set(null);
      return;
    }
    this.openSha.set(sha);
    this.feed.load(this.repo(), sha);
  }

  protected retry(): void {
    const sha = this.openSha();
    if (sha) this.feed.load(this.repo(), sha);
  }

  /** Closes the open commit and puts focus back on its line, as a disclosure does. */
  protected close(): void {
    const sha = this.openSha();
    if (!sha) return;
    this.openSha.set(null);
    afterNextRender(() => this.lineOf(sha)?.focus(), { injector: this.injector });
  }

  private lineOf(sha: string): HTMLButtonElement | null {
    return this.host.nativeElement.querySelector(`button[data-key="${CSS.escape(sha)}"]`);
  }
}
