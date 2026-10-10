import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { map } from 'rxjs';
import { ReleaseTimeline, releaseTimeline } from '../../../core/releases/release-timeline';
import { ReleasesFeed } from '../../../core/releases/releases-feed';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { ProjectBarRoom } from '../../../shared/project-bar-room/project-bar-room';
import { ReleaseDetailPanel } from '../release-detail/release-detail';
import { detailOf, firstPick } from '../release-detail/release-detail-view';
import { ReleaseList } from '../release-list/release-list';
import { ReleaseSky, SkyInsets } from '../release-sky/release-sky';
import { PageMessage, releasesNote, releasesStamp, stateMessage } from './releases-words';

export type ReleasesView = 'sky' | 'list';

/** The header's height, which the trajectory keeps clear of. */
const TOP_INSET = 170;
const BOTTOM_INSET = 24;
/** Past this width the panel takes its own column down the right. */
const SIDE_PANEL_MIN_WIDTH = 900;
const SIDE_PANEL_WIDTH = 410;
/** Narrower, the panel rises from the bottom and takes this share of the height. */
const BOTTOM_PANEL_SHARE = 0.46;
const NO_SIZE = { width: 0, height: 0 };

const repoOf = (params: ParamMap): string =>
  `${params.get('owner') ?? ''}/${params.get('repo') ?? ''}`;

/**
 * A project's Releases screen: its releases as a space timeline, or as a
 * list, and the picked one's notes and merged pull requests beside it.
 */
@Component({
  selector: 'app-releases-page',
  imports: [ProjectBarRoom, ReleaseSky, ReleaseList, ReleaseDetailPanel],
  providers: [ReleasesFeed],
  templateUrl: './releases-page.html',
  styleUrl: './releases-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReleasesPage {
  private readonly feed = inject(ReleasesFeed);
  private readonly route = inject(ActivatedRoute);
  private readonly size = toSignal(
    inject(ELEMENT_SIZE)(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement),
    { initialValue: NO_SIZE },
  );

  private readonly repoChanges = this.route.paramMap.pipe(map(repoOf));
  protected readonly repo = toSignal(this.repoChanges, { initialValue: '' });
  protected readonly view = signal<ReleasesView>('sky');
  /** What the viewer picked; until then, the screen's own first pick. */
  private readonly picked = signal<string | null>(null);

  private readonly report = computed(() => {
    const state = this.feed.state();
    return state.status === 'ready' ? state.report : null;
  });
  protected readonly timeline = computed((): ReleaseTimeline | null => {
    const report = this.report();
    return report ? releaseTimeline(report) : null;
  });
  protected readonly isEmpty = computed(() => {
    const timeline = this.timeline();
    return timeline !== null && !timeline.releases.length && !timeline.unreleased;
  });
  protected readonly selected = computed((): string | null => {
    const timeline = this.timeline();
    if (!timeline) return null;
    const picked = this.picked();
    return picked !== null && detailOf(timeline, picked) ? picked : firstPick(timeline);
  });
  protected readonly detail = computed(() => {
    const timeline = this.timeline();
    return timeline ? detailOf(timeline, this.selected()) : null;
  });
  protected readonly message = computed(
    (): PageMessage | null => stateMessage(this.feed.state()) ?? this.emptyMessage(),
  );
  protected readonly stamp = computed(() => releasesStamp(this.repo(), this.report()));
  protected readonly note = computed(() => releasesNote(this.report()));
  protected readonly hasSidePanel = computed(() => this.size().width >= SIDE_PANEL_MIN_WIDTH);
  protected readonly insets = computed((): SkyInsets => {
    const hasDetail = this.detail() !== null;
    const isSide = this.hasSidePanel();
    return {
      top: TOP_INSET,
      right: hasDetail && isSide ? SIDE_PANEL_WIDTH : 0,
      bottom: hasDetail && !isSide ? this.size().height * BOTTOM_PANEL_SHARE : BOTTOM_INSET,
      left: 0,
    };
  });

  constructor() {
    this.repoChanges.pipe(takeUntilDestroyed()).subscribe((repo) => {
      this.picked.set(null);
      this.feed.load(repo);
    });
  }

  protected pick(key: string): void {
    this.picked.set(key);
  }

  private emptyMessage(): PageMessage | null {
    return this.isEmpty()
      ? { headline: 'Nothing shipped yet', detail: 'No releases, and no merged pull requests.' }
      : null;
  }
}
