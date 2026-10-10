import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { map } from 'rxjs';
import { MilestonesFeed } from '../../../core/milestones/milestones-feed';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { ProjectBarRoom } from '../../../shared/project-bar-room/project-bar-room';
import { SkyInsets } from '../../releases/release-sky/release-sky';
import { DiscussionList } from '../discussion-list/discussion-list';
import { DUE_STATES, dueColour } from '../milestone-look';
import { MilestoneList } from '../milestone-list/milestone-list';
import {
  DUE_WORDS,
  discussionsNote,
  emptyMessage,
  milestonesStamp,
  skyNote,
  stateMessage,
} from '../milestone-words';
import { TransitSky } from '../transit-sky/transit-sky';

export type MilestonesView = 'sky' | 'list';

/** The header's height, which the lanes keep clear of; it wraps to more on a narrow screen. */
const TOP_INSET = 190;
const NARROW_TOP_INSET = 250;
/** The playlist dock along the foot. */
const BOTTOM_INSET = 110;
/** Past this width the discussions take their own column down the right; narrower, they
 *  follow the milestones in the List view, so a phone's sky keeps its height for the lanes. */
const SIDE_PANEL_MIN_WIDTH = 900;
const SIDE_PANEL_WIDTH = 410;
const NO_SIZE = { width: 0, height: 0 };

const repoOf = (params: ParamMap): string =>
  `${params.get('owner') ?? ''}/${params.get('repo') ?? ''}`;

/**
 * A project's Milestones: each open milestone as a planet in transit toward
 * its due date, or as a list with its issues and pull requests, and the
 * project's latest discussions beside them.
 */
@Component({
  selector: 'app-milestones-page',
  imports: [NgTemplateOutlet, ProjectBarRoom, TransitSky, MilestoneList, DiscussionList],
  providers: [MilestonesFeed],
  templateUrl: './milestones-page.html',
  styleUrls: ['../../releases/releases-page/releases-page.css', './milestones-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MilestonesPage {
  private readonly feed = inject(MilestonesFeed);
  private readonly repoChanges = inject(ActivatedRoute).paramMap.pipe(map(repoOf));
  private readonly size = toSignal(
    inject(ELEMENT_SIZE)(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement),
    { initialValue: NO_SIZE },
  );

  protected readonly repo = toSignal(this.repoChanges, { initialValue: '' });
  protected readonly view = signal<MilestonesView>('sky');
  protected readonly legend = DUE_STATES.map((state) => ({
    key: state,
    label: DUE_WORDS[state],
    colour: dueColour(state),
  }));

  protected readonly report = computed(() => {
    const state = this.feed.state();
    return state.status === 'ready' ? state.report : null;
  });
  /** The list says for itself when it is empty; the sky needs it said over it. */
  protected readonly message = computed(() => {
    const report = this.report();
    if (!report) return stateMessage(this.feed.state());
    return this.view() === 'sky' ? emptyMessage(report) : null;
  });
  protected readonly stamp = computed(() => milestonesStamp(this.repo(), this.report()));
  protected readonly note = computed(() => {
    const report = this.report();
    return report ? skyNote(report) : null;
  });
  protected readonly discussionsNote = computed(() => {
    const report = this.report();
    return report ? discussionsNote(report) : null;
  });
  protected readonly discussionsLink = computed(
    () => `https://github.com/${this.repo()}/discussions`,
  );
  protected readonly hasSidePanel = computed(() => this.size().width >= SIDE_PANEL_MIN_WIDTH);
  protected readonly insets = computed((): SkyInsets =>
    this.hasSidePanel()
      ? { top: TOP_INSET, right: SIDE_PANEL_WIDTH, bottom: BOTTOM_INSET, left: 0 }
      : { top: NARROW_TOP_INSET, right: 0, bottom: BOTTOM_INSET, left: 0 },
  );

  constructor() {
    this.repoChanges.pipe(takeUntilDestroyed()).subscribe((repo) => this.feed.load(repo));
  }

  protected refresh(): void {
    this.feed.refresh();
  }
}
