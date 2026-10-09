import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  untracked,
} from '@angular/core';
import { PullEdits } from '../../../core/edits/pull-edits';
import { PullDetailFeed } from '../../../core/queue/pull-detail-feed';
import { QueueBucket } from '../../../core/queue/queue-report';
import { LandedBase } from '../../../core/queue/stacks';
import { ViewerSession } from '../../../core/session/viewer-session';
import { Draggable } from '../../../shared/draggable/draggable';
import { BUCKET_LOOK } from '../../queue/queue-view';
import { SheetDiffTab } from './sheet-diff-tab/sheet-diff-tab';
import { SheetEditor } from './sheet-editor/sheet-editor';
import { HeaderState, SheetHeader } from './sheet-header/sheet-header';
import { MergeBox } from './merge-box/merge-box';
import { SheetMarkdown } from './sheet-markdown/sheet-markdown';
import { SheetPreview } from './sheet-preview/sheet-preview';
import { SheetCommits } from './sheet-commits/sheet-commits';
import { checkRows, fileRows } from './sheet-rows/sheet-row';
import { SheetRows } from './sheet-rows/sheet-rows';
import {
  NO_COUNTS,
  READ_TABS,
  SHEET_TABS,
  SheetTab,
  kickerOf,
  routeOf,
  tabCounts,
} from './sheet-view';
import { AgentLanes } from '../../../shared/agent-lanes/agent-lanes';
import { CrewControl } from '../crew-control/crew-control';

/** Where the screen is left when dragged, per viewer, as pr-starmap keeps it. */
const PLACE_KEY = 'queue.sheetPos';
const TYPING = 'input, textarea, select';

/**
 * pr-starmap's PR screen: one pull request's description, files, commits,
 * checks and diff in a window that can be dragged by its header, with an Edit
 * tab that changes it on GitHub and a merge box along its foot. A viewer who
 * may not write, such as a hosted visitor, gets it read-only: none of those.
 */
@Component({
  selector: 'app-pr-screen',
  imports: [
    Draggable,
    SheetHeader,
    SheetMarkdown,
    SheetPreview,
    SheetRows,
    SheetCommits,
    SheetDiffTab,
    SheetEditor,
    AgentLanes,
    MergeBox,
    CrewControl,
  ],
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
  /** The head when it was last looked at, before this screen opened; null for never. */
  readonly lookedSha = input<string | null>(null);
  /** The merge of the base it was stacked on, once that has merged: a crew updates it. */
  readonly landed = input<LandedBase | null>(null);
  /** Its failing checks known to be flaky, as the queue knows them. */
  readonly flakyChecks = input<readonly string[]>([]);
  readonly closed = output<void>();
  /** The head of an open pull request as this screen shows it: it is being looked at. */
  readonly looked = output<string>();

  private readonly feed = inject(PullDetailFeed);
  private readonly edits = inject(PullEdits);

  protected readonly placeKey = PLACE_KEY;
  protected readonly canWrite = inject(ViewerSession).canWrite;
  protected readonly tabs = computed(() => (this.canWrite() ? SHEET_TABS : READ_TABS));
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
  protected readonly shownBucket = computed(() => this.bucket() ?? this.detail()?.bucket ?? null);
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
  /** A string, so the look is reported once per head rather than once per read. */
  private readonly shownOpenHead = computed(() => {
    const detail = this.detail();
    return detail?.state === 'open' ? detail.headOid : '';
  });
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
  protected readonly checks = computed(() => {
    const detail = this.detail();
    return detail ? checkRows(detail, this.flakyChecks()) : [];
  });

  constructor() {
    effect(() => {
      this.feed.load(this.repo(), this.number());
    });
    effect(() => {
      if (this.canWrite()) this.edits.load(this.repo(), this.number());
    });
    effect(() => {
      const head = this.shownOpenHead();
      // Whatever the listener reads must not make this effect report the look again.
      if (head) untracked(() => this.looked.emit(head));
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
