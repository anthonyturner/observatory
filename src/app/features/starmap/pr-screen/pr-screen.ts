import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { PullEdits } from '../../../core/edits/pull-edits';
import { PullDetailFeed } from '../../../core/queue/pull-detail-feed';
import { QueueBucket } from '../../../core/queue/queue-report';
import { Draggable } from '../../../shared/draggable/draggable';
import { BUCKET_LOOK } from '../../queue/queue-view';
import { SheetDiff } from './sheet-diff/sheet-diff';
import { SheetEditor } from './sheet-editor/sheet-editor';
import { HeaderState, SheetHeader } from './sheet-header/sheet-header';
import { SheetMarkdown } from './sheet-markdown/sheet-markdown';
import { checkRows, commitRows, commitsNote, fileRows } from './sheet-rows/sheet-row';
import { SheetRows } from './sheet-rows/sheet-rows';
import { NO_COUNTS, SHEET_TABS, SheetTab, kickerOf, routeOf, tabCounts } from './sheet-view';

/** Where the screen is left when dragged, per viewer, as pr-starmap keeps it. */
const PLACE_KEY = 'queue.sheetPos';
const TYPING = 'input, textarea, select';

/**
 * pr-starmap's PR screen: one pull request's description, files, commits,
 * checks and diff in a window that can be dragged by its header, with an Edit
 * tab that changes it on GitHub.
 */
@Component({
  selector: 'app-pr-screen',
  imports: [Draggable, SheetHeader, SheetMarkdown, SheetRows, SheetDiff, SheetEditor],
  providers: [PullDetailFeed, PullEdits],
  templateUrl: './pr-screen.html',
  styleUrl: './pr-screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown.escape)': 'leaveField($event)',
    '(document:keydown.escape)': 'closed.emit()',
  },
})
export class PrScreen {
  readonly repo = input.required<string>();
  readonly number = input.required<number>();
  /** The bucket the queue shows it in; until given, the one its details say. */
  readonly bucket = input<QueueBucket | null>(null);
  /** Its title as the queue knows it, shown before the details arrive. */
  readonly title = input<string | null>(null);
  readonly closed = output<void>();

  private readonly feed = inject(PullDetailFeed);
  private readonly edits = inject(PullEdits);

  protected readonly placeKey = PLACE_KEY;
  protected readonly tabs = SHEET_TABS;
  /** Each pull request opens on its description, as pr-starmap's screen does. */
  protected readonly tab = linkedSignal<number, SheetTab>({
    source: this.number,
    computation: () => 'overview',
  });
  protected readonly detail = computed(() => {
    const state = this.feed.state();
    return state.status === 'ready' ? state.detail : null;
  });
  protected readonly unreachable = computed(() => this.feed.state().status === 'unreachable');
  private readonly shownBucket = computed(() => this.bucket() ?? this.detail()?.bucket ?? null);
  protected readonly kicker = computed(() => {
    const bucket = this.shownBucket();
    return bucket ? kickerOf(bucket) : '';
  });
  protected readonly colour = computed(() => {
    const bucket = this.shownBucket();
    return bucket ? BUCKET_LOOK[bucket].color : 'var(--flow)';
  });
  protected readonly shownTitle = computed(() => this.title() ?? this.detail()?.title ?? '');
  protected readonly url = computed(
    () => `https://github.com/${this.repo()}/pull/${this.number()}`,
  );
  protected readonly header = computed((): HeaderState => {
    const detail = this.detail();
    return {
      route: detail ? routeOf(detail) : null,
      loading: this.feed.state().status === 'reading',
      fetching: this.feed.fetching(),
      badge: this.edits.badge(),
      hasNewer: this.feed.newer() !== null,
      counts: detail ? tabCounts(detail) : NO_COUNTS,
    };
  });
  protected readonly files = computed(() => {
    const detail = this.detail();
    return detail ? fileRows(detail) : [];
  });
  protected readonly commits = computed(() => {
    const detail = this.detail();
    return detail ? commitRows(detail) : [];
  });
  protected readonly commitsNote = computed(() => {
    const detail = this.detail();
    return detail ? commitsNote(detail) : null;
  });
  protected readonly checks = computed(() => {
    const detail = this.detail();
    return detail ? checkRows(detail) : [];
  });

  constructor() {
    effect(() => {
      this.feed.load(this.repo(), this.number());
      this.edits.load(this.repo(), this.number());
    });
  }

  protected refresh(): void {
    this.feed.refresh();
  }

  protected showNewer(): void {
    this.feed.showNewer();
  }

  /** Esc in a field leaves the field, and the screen stays open. */
  protected leaveField(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.closest(TYPING)) return;
    target.blur();
    event.stopPropagation();
  }
}
