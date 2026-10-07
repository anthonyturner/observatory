import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { ActionsFeed } from '../../../core/actions/actions-feed';
import { RunOutcome } from '../../../core/actions/actions-report';
import { RunJobsFeed } from '../../../core/actions/run-jobs-feed';
import {
  NO_FILTER,
  RunFilter,
  filterChoices,
  filterRuns,
  isFiltered,
} from '../../../core/actions/run-filter';
import { ViewerSession } from '../../../core/session/viewer-session';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { ProjectTabs } from '../../../shared/project-tabs/project-tabs';
import { UpLink } from '../../../shared/up-link/up-link';
import { SkyInsets } from '../../releases/release-sky/release-sky';
import { PageMessage } from '../../releases/releases-page/releases-words';
import { OUTCOME_WORDS, ciHealthWords } from '../actions-words';
import { JobsView, RunDetailPanel } from '../run-detail/run-detail';
import { firstPick, jobViews, runDetailOf } from '../run-detail/run-detail-view';
import { RunList } from '../run-list/run-list';
import { outcomeColour } from '../run-sky/run-look';
import { RunSky } from '../run-sky/run-sky';
import { actionsStamp, emptyMessage, quietWorkflowsNote, stateMessage } from './actions-page-words';

export type ActionsView = 'sky' | 'list';

/** The header's height, with its filters, which the lanes keep clear of. */
const TOP_INSET = 210;
/** Clear of the playlist dock along the foot of the screen. */
const BOTTOM_INSET = 100;
/** Past this width the panel takes its own column down the right. */
const SIDE_PANEL_MIN_WIDTH = 900;
const SIDE_PANEL_WIDTH = 410;
/** Narrower, the panel rises from the bottom and takes this share of the height. */
const BOTTOM_PANEL_SHARE = 0.46;
const NO_SIZE = { width: 0, height: 0 };
/** What a filter's "all" option carries. */
const ALL = '';
const LEGEND: readonly RunOutcome[] = ['failed', 'running', 'passed', 'cancelled'];

const repoOf = (params: ParamMap): string =>
  `${params.get('owner') ?? ''}/${params.get('repo') ?? ''}`;

const valueOf = (event: Event): string | null => {
  const value = event.target instanceof HTMLSelectElement ? event.target.value : ALL;
  return value === ALL ? null : value;
};

/** Which run's jobs to read: again whenever the runs are read anew, as a run still going moves on. */
interface JobsKey {
  readonly repo: string;
  readonly runId: number | null;
  readonly readAt: number;
}

const sameJobsKey = (a: JobsKey, b: JobsKey): boolean =>
  a.repo === b.repo && a.runId === b.runId && a.readAt === b.readAt;

/**
 * A project's Actions screen: its workflow runs as a sky of lanes, or as a
 * list, narrowed by workflow, branch and outcome, and the picked run's jobs
 * and failed steps beside it.
 */
@Component({
  selector: 'app-actions-page',
  imports: [UpLink, ProjectTabs, RunSky, RunList, RunDetailPanel],
  providers: [ActionsFeed, RunJobsFeed],
  templateUrl: './actions-page.html',
  styleUrls: ['../../releases/releases-page/releases-page.css', './actions-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionsPage {
  private readonly feed = inject(ActionsFeed);
  private readonly jobsFeed = inject(RunJobsFeed);
  private readonly session = inject(ViewerSession);
  private readonly route = inject(ActivatedRoute);
  private readonly size = toSignal(
    inject(ELEMENT_SIZE)(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement),
    { initialValue: NO_SIZE },
  );

  private readonly repoChanges = this.route.paramMap.pipe(map(repoOf));
  protected readonly repo = toSignal(this.repoChanges, { initialValue: '' });
  protected readonly view = signal<ActionsView>('sky');
  protected readonly filter = signal<RunFilter>(NO_FILTER);
  /** What the viewer picked; until then, the screen's own first pick. */
  private readonly picked = signal<string | null>(null);

  protected readonly report = computed(() => {
    const state = this.feed.state();
    return state.status === 'ready' ? state.report : null;
  });
  private readonly allRuns = computed(() => this.report()?.runs ?? []);
  protected readonly choices = computed(() => filterChoices(this.allRuns()));
  protected readonly outcomeChoices = computed(() =>
    this.choices().outcomes.map((outcome) => ({ value: outcome, label: OUTCOME_WORDS[outcome] })),
  );
  protected readonly runs = computed(() => filterRuns(this.allRuns(), this.filter()));
  protected readonly isFiltered = computed(() => isFiltered(this.filter()));
  protected readonly selected = computed((): string | null => {
    const [picked, runs] = [this.picked(), this.runs()];
    return picked !== null && runs.some((run) => String(run.id) === picked)
      ? picked
      : firstPick(runs);
  });
  private readonly selectedRun = computed(
    () => this.runs().find((run) => String(run.id) === this.selected()) ?? null,
  );
  protected readonly detail = computed(() => {
    const [run, report] = [this.selectedRun(), this.report()];
    return run && report ? runDetailOf(run, report.workflows, report.generatedAt) : null;
  });
  protected readonly jobs = computed((): JobsView => {
    const state = this.jobsFeed.state();
    if (state.status === 'ready') {
      return { status: 'ready', jobs: jobViews(state.jobs.jobs, this.report()?.flakyChecks ?? []) };
    }
    return { status: state.status === 'unreachable' ? 'unreachable' : 'reading' };
  });
  protected readonly canRerun = computed(
    () => this.session.canWrite() && (this.detail()?.hasFailedJobs ?? false),
  );
  protected readonly health = computed(() => {
    const health = this.report()?.health;
    return health ? { words: ciHealthWords(health), colour: `var(--ci-${health.state})` } : null;
  });
  protected readonly message = computed((): PageMessage | null => {
    const report = this.report();
    const empty = report ? emptyMessage(report, this.runs().length) : null;
    return stateMessage(this.feed.state()) ?? empty;
  });
  protected readonly quietNote = computed(() => {
    const report = this.report();
    return report ? quietWorkflowsNote(report) : null;
  });
  protected readonly stamp = computed(() =>
    actionsStamp(this.repo(), this.report(), this.runs().length),
  );
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
  protected readonly legend = LEGEND.map((outcome) => ({
    key: outcome,
    label: OUTCOME_WORDS[outcome],
    colour: outcomeColour(outcome),
  }));

  constructor() {
    this.repoChanges.pipe(takeUntilDestroyed()).subscribe((repo) => {
      this.picked.set(null);
      this.filter.set(NO_FILTER);
      this.feed.load(repo);
    });
    const jobsKey = computed((): JobsKey => ({
      repo: this.repo(),
      runId: this.selectedRun()?.id ?? null,
      readAt: this.report()?.generatedAt ?? 0,
    }));
    toObservable(jobsKey)
      .pipe(distinctUntilChanged(sameJobsKey), takeUntilDestroyed())
      .subscribe(({ repo, runId }) => this.jobsFeed.load(repo, runId));
  }

  protected pick(key: string): void {
    this.picked.set(key);
  }

  protected setWorkflow(event: Event): void {
    const workflow = valueOf(event);
    this.filter.update((filter) => ({ ...filter, workflow }));
  }

  protected setBranch(event: Event): void {
    const branch = valueOf(event);
    this.filter.update((filter) => ({ ...filter, branch }));
  }

  protected setOutcome(event: Event): void {
    const value = valueOf(event);
    const outcome = this.choices().outcomes.find((each) => each === value) ?? null;
    this.filter.update((filter) => ({ ...filter, outcome }));
  }

  protected clearFilter(): void {
    this.filter.set(NO_FILTER);
  }

  /** GitHub took a rerun: read the runs afresh so it shows as going. */
  protected rerunRequested(): void {
    this.feed.refresh();
  }
}
