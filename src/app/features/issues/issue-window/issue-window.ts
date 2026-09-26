import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { IssueDetailFeed } from '../../../core/issues/issue-detail-feed';
import { Issue } from '../../../core/issues/issues-report';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { Draggable } from '../../../shared/draggable/draggable';
import { SheetMarkdown } from '../../starmap/pr-screen/sheet-markdown/sheet-markdown';
import { OpenPull, labelChips, pullChips } from '../issue-list';
import { IssueMeta } from '../issue-meta/issue-meta';
import { IssueInfo, barLabelOf, kickerOf, metaLineOf } from './issue-window-view';

/** Where the window is left, per viewer, as pr-starmap keeps it. */
const PLACE_KEY = 'queue.issuePos';
/** The keys that scroll the description while the window has focus. */
const STEP: Readonly<Record<string, number>> = {
  ArrowDown: 40,
  ArrowUp: -40,
  PageDown: 0.9,
  PageUp: -0.9,
};

const REFETCH_WORDS = {
  fetching: 'Fetching…',
  updated: 'Updated',
  kept: 'GitHub didn’t return this issue, so this is the copy from before.',
} as const;

const isShown = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLElement && el.isConnected && el.getClientRects().length > 0;

/**
 * pr-starmap's issue window: an issue read without leaving the page. It floats
 * rather than blocks, so the list stays clickable underneath, and opening
 * another issue swaps it in place. The header draws at once from the list's
 * row, and the description follows from GitHub.
 */
@Component({
  selector: 'app-issue-window',
  imports: [Draggable, IssueMeta, SheetMarkdown],
  providers: [IssueDetailFeed],
  templateUrl: './issue-window.html',
  styleUrls: ['./issue-window.css', './issue-window-head.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueWindow {
  readonly repo = input.required<string>();
  readonly number = input.required<number>();
  /** The list's row for it, when the list has one. */
  readonly seed = input<Issue | null>(null);
  readonly pulls = input.required<ReadonlyMap<number, OpenPull>>();
  /** The clock to the minute. */
  readonly now = input.required<number>();
  readonly closed = output<void>();
  /** Asks for an open pull request's screen. */
  readonly pull = output<number>();

  private readonly feed = inject(IssueDetailFeed);
  private readonly document = inject(DOCUMENT);
  private readonly win = viewChild.required<ElementRef<HTMLElement>>('win');
  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  /** What had focus when the window opened, to hand it back on closing. */
  private readonly opener = this.document.activeElement;
  private shown: number | null = null;

  protected readonly still = inject(MotionPreference).isStill;
  protected readonly placeKey = PLACE_KEY;
  protected readonly state = this.feed.state;
  protected readonly detail = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.detail : null;
  });
  protected readonly info = computed((): IssueInfo => ({
    ...this.seed(),
    ...this.detail(),
    number: this.number(),
  }));
  protected readonly kicker = computed(() => kickerOf(this.info()));
  protected readonly barLabel = computed(() => barLabelOf(this.number(), this.kicker()));
  protected readonly url = computed(
    () => this.info().url ?? `https://github.com/${this.repo()}/issues/${this.number()}`,
  );
  protected readonly metaLine = computed(() => metaLineOf(this.info(), this.now()));
  protected readonly labels = computed(() => labelChips(this.info().labels ?? []));
  protected readonly assignees = computed(() => this.info().assignees ?? []);
  /** Said only once the assignees are known, and only while it is open. */
  protected readonly unassigned = computed(() => {
    const { assignees, closedAt } = this.info();
    return assignees?.length === 0 && !closedAt;
  });
  protected readonly chips = computed(() =>
    pullChips(this.info().prs ?? [], this.url(), this.pulls()),
  );
  protected readonly fetching = computed(() => this.feed.refetch() === 'fetching');
  protected readonly status = computed(() => {
    const outcome = this.feed.refetch();
    return outcome ? REFETCH_WORDS[outcome] : '';
  });

  constructor() {
    effect(() => {
      const [repo, number] = [this.repo(), this.number()];
      untracked(() => this.open(repo, number));
    });
    inject(DestroyRef).onDestroy(() => this.returnFocus());
  }

  protected refresh(): void {
    this.feed.refresh();
  }

  /** Focus sits on the window, not on the part that scrolls, so the keys that
   *  would pan the sky scroll the description instead. */
  protected onKey(event: KeyboardEvent): void {
    const step = STEP[event.key];
    const body = this.body().nativeElement;
    const target = event.target;
    if (step === undefined || target === body) return;
    if (target instanceof Element && target.closest('a, button')) return;
    const scroller = body.scrollHeight > body.clientHeight ? body : this.win().nativeElement;
    event.preventDefault();
    scroller.scrollBy({ top: Math.abs(step) < 1 ? step * scroller.clientHeight : step });
  }

  /** A first issue focuses the window; a swapped one, its title. */
  private open(repo: string, number: number): void {
    const swap = this.shown !== null;
    this.shown = number;
    this.feed.load(repo, number);
    const win = this.win().nativeElement;
    win.scrollTop = 0;
    this.body().nativeElement.scrollTop = 0;
    (swap ? this.heading().nativeElement : win).focus({ preventScroll: true });
  }

  /** Back to what opened the window if it is still on screen; else this
   *  issue's row, or an issue card's Open. */
  private returnFocus(): void {
    const candidates = [
      this.opener === this.document.body ? null : this.opener,
      this.document.querySelector(`a[data-issue="${this.shown}"]`),
      this.document.querySelector('.card [data-openissue]'),
    ];
    candidates.find(isShown)?.focus();
  }
}
