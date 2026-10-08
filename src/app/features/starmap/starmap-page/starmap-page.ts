import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, map, timer } from 'rxjs';
import { ageWords, fogLevel } from '../../../core/projects/data-age';
import { CollisionsFeed } from '../../../core/queue/collisions-feed';
import { HistoryFeed } from '../../../core/queue/history-feed';
import { LedgerFeed } from '../../../core/queue/ledger-feed';
import { VideoBackground } from '../../../core/playlist/video-background';
import { VideoSky } from '../../playlist/video-sky/video-sky';
import { QueueItem, shownBucket } from '../../../core/queue/queue-report';
import { QueueFeed } from '../../../core/queue/queue-feed';
import { Stacks, stacksOf } from '../../../core/queue/stacks';
import { queueFog } from '../../../core/queue/queue-fog';
import { SNOOZE_DAYS, TriageChoice, TriageClient } from '../../../core/queue/triage-client';
import { ViewerSession } from '../../../core/session/viewer-session';
import { Clock } from '../../../core/time/clock';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { UsageWatch } from '../../../core/usage/usage-watch';
import { HelpShortcuts } from '../../../shared/help/help-shortcuts';
import { IssueBar } from '../../issues/issue-bar/issue-bar';
import { IssueCard } from '../../issues/issue-card/issue-card';
import { IssueStar } from '../../issues/issue-look';
import { openPullsOf } from '../../issues/issue-list';
import { IssueWindow } from '../../issues/issue-window/issue-window';
import { IssuesPanel } from '../../issues/issues-panel/issues-panel';
import { IssuesScreen } from '../../issues/issues-screen';
import { nurseryInputOf } from '../nursery/nursery-layout';
import { Meteor, MeteorLanding, meteorsOf } from '../engine/meteor-layer';
import { ChangesPanel } from '../memory/changes-panel/changes-panel';
import { MemoryView } from '../memory/memory-view';
import { EFFECTS, MemoryItem, knownFates } from '../memory/news';
import { Timeline } from '../memory/timeline/timeline';
import { binaries } from '../engine/binary-layer';
import { CardContext } from '../star-card/card-facts';
import { BlackHoleSetting } from '../black-hole/black-hole-setting';
import { StarCard } from '../star-card/star-card';
import { CrewDispatch } from '../../../core/crew/crew-dispatch';
import { crewMarksOf } from '../../../core/crew/crew-roster';
import { CometCard } from '../comet-card/comet-card';
import { StarmapSound } from '../sound/starmap-sound';
import { mergePlan } from '../merge-plan';
import { nextStar } from '../next-star';
import { ringedComet, ringedPull, tetherOf } from '../open-star';
import { PlanPanel } from '../plan-panel/plan-panel';
import { AgentsPanel } from '../agents-panel/agents-panel';
import { DonePanel } from '../done-panel/done-panel';
import { DoneItem, DoneKind, doneWork, isPull } from '../../../core/queue/done-work';
import { AgentsFeed } from '../../../core/agents/agents-report';
import { AGENT_FILTER, SPRINT_FILTER } from '../starmap-sky/starmap-sky';
import { ReviewSprint } from '../sprint/review-sprint';
import { SprintPanel } from '../sprint/sprint-panel/sprint-panel';
import { SprintOption, mergedOf, sprintOptions, sprintRows } from '../sprint/sprint-plan';
import { COMET_CAP, COMET_COLOUR, Comet, cometsOf } from '../comets';
import { IssuesFeed } from '../../../core/issues/issues-feed';
import { LogsFeed } from '../../../core/logs/logs-feed';
import { LogKey } from '../../../core/logs/log-levels';
import { LogStar } from '../../../core/logs/log-layout';
import { LogCard } from '../../logs/log-card/log-card';
import { LogList } from '../../logs/log-list/log-list';
import { MeteorRecord } from '../../logs/meteor-record/meteor-record';
import { LogSkyView } from '../log-sky-view';
import { StarmapHelp } from '../starmap-help/starmap-help';
import { HelpKey } from '../starmap-help/help-content';
import { PrScreen } from '../pr-screen/pr-screen';
import { skyItemOf, skyPairOf } from '../sky-items';
import { SearchedIssue, findOnSky, searchSuggestions } from '../sky-search';
import { StarmapHeader } from '../starmap-header/starmap-header';
import { StarmapPrList } from '../starmap-pr-list/starmap-pr-list';
import { StarmapSearch } from '../starmap-search/starmap-search';
import { SkyChart, SkyInsets, StarmapSky } from '../starmap-sky/starmap-sky';
import { StarmapTools } from '../starmap-tools/starmap-tools';
import { StarmapUsage } from '../starmap-usage/starmap-usage';
import { StarmapRetro } from '../starmap-retro/starmap-retro';
import { retroStamp } from '../starmap-retro/retro-charts';
import { wipCheck } from '../wip-limit/wip-check';
import { WipLimitSetting } from '../wip-limit/wip-limit-setting';
import { WipNotice } from '../wip-limit/wip-notice/wip-notice';
import { usageStamp } from '../starmap-usage/usage-text';
import {
  Chart,
  SkyView,
  chartOf,
  fragmentOf,
  LegendChip,
  isListOnly,
  queueChips,
  queueStamp,
  titleOf,
} from '../starmap-view';

/** The chrome Fit keeps the sky clear of, as pr-starmap measures it. */
const TOP_INSET = 140;
/** With the issue bar docked under the title, over the nursery. */
const TOP_INSET_WITH_DOCK = 205;
/** The review queue's search box, under its legend. */
const SEARCH_HEIGHT = 44;
/** The work-in-progress notice, under the search. */
const WIP_NOTICE_HEIGHT = 56;
const BOTTOM_INSET = 70;
/** With a chart along the bottom, as the Log Sky's meteor record. */
const BOTTOM_INSET_WITH_STRIP = 200;
/** Past this width a panel down the right edge takes its own column. */
const SIDE_PANEL_MIN_WIDTH = 900;
/** The changes panel's width and the gap beside it. */
const SIDE_PANEL_WIDTH = 380;
/** The merge plan's panel and the gap beside it. */
const PLAN_PANEL_WIDTH = 400;
/** No failing check is known to be flaky: one list, so the PR screen's input keeps its reference. */
const NO_FLAKY_CHECKS: readonly string[] = [];
/** How long Next star leaves its star lit, card open, before opening its PR screen. */
const NEXT_STAR_HOLD_MS = 900;

/** Blocked buckets: the tension voice counts them. */
const BLOCKED: ReadonlySet<string> = new Set(['conflicted', 'failing']);

/** A past refresh on screen shows no stacks: they are the queue as it is. */
const NO_STACKS: Stacks = new Map();

/** The comets' legend chip, which shows and hides them rather than filtering. */
const COMETS = 'comets';

/** Keys typed into a field belong to the field. */
const TYPING = 'input, textarea, select, [contenteditable]';

/** An open pull request as the memory compares it. */
const memoryItemOf = (item: QueueItem): MemoryItem => ({
  pr: item.number,
  title: item.title,
  bucket: shownBucket(item),
  idleDays: item.idleDays,
});

/** A message in place of the sky: a headline, and what to do about it. */
export interface SkyState {
  readonly headline: string;
  readonly detail?: string;
}

/**
 * pr-starmap's star map page: the sky, the list behind it, the header and
 * legend at the top and the tools along the bottom, for each of its screens.
 */
@Component({
  selector: 'app-starmap-page',
  imports: [
    VideoSky,
    StarmapSky,
    StarmapHeader,
    StarmapSearch,
    StarmapTools,
    StarmapPrList,
    IssuesPanel,
    IssueBar,
    IssueCard,
    IssueWindow,
    ChangesPanel,
    Timeline,
    StarmapUsage,
    StarmapRetro,
    PrScreen,
    StarCard,
    CometCard,
    PlanPanel,
    AgentsPanel,
    DonePanel,
    LogCard,
    LogList,
    MeteorRecord,
    StarmapHelp,
    SprintPanel,
    WipNotice,
  ],
  hostDirectives: [HelpShortcuts],
  host: {
    '(document:keydown.escape)': 'closeTopmost()',
    '(document:keydown)': 'onKey($event)',
  },
  providers: [
    QueueFeed,
    HistoryFeed,
    LedgerFeed,
    AgentsFeed,
    CollisionsFeed,
    LogsFeed,
    LogSkyView,
    MemoryView,
    UsageWatch,
    IssuesFeed,
    IssuesScreen,
    ReviewSprint,
  ],
  templateUrl: './starmap-page.html',
  styleUrl: './starmap-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarmapPage {
  private readonly feed = inject(QueueFeed);
  private readonly history = inject(HistoryFeed);
  protected readonly collisions = inject(CollisionsFeed);
  private readonly ledger = inject(LedgerFeed);
  protected readonly memory = inject(MemoryView);
  protected readonly agents = inject(AgentsFeed);
  private readonly sound = inject(StarmapSound);
  protected readonly usage = inject(UsageWatch);
  private readonly triage = inject(TriageClient);
  protected readonly session = inject(ViewerSession);
  protected readonly logs = inject(LogSkyView);
  protected readonly issues = inject(IssuesScreen);
  private readonly router = inject(Router);
  private readonly crew = inject(CrewDispatch);
  protected readonly sprint = inject(ReviewSprint);
  protected readonly motion = inject(MotionPreference);
  protected readonly video = inject(VideoBackground);
  private readonly blackHole = inject(BlackHoleSetting);
  private readonly wipLimit = inject(WipLimitSetting);
  private readonly route = inject(ActivatedRoute);
  private readonly now = inject(Clock).now;
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly destroyRef = inject(DestroyRef);
  /** Next star's wait between lighting its star and opening the PR screen. */
  private nextHold: Subscription | null = null;

  protected readonly repo = toSignal(
    this.route.paramMap.pipe(
      map((params) => `${params.get('owner') ?? ''}/${params.get('repo') ?? ''}`),
    ),
    { initialValue: '' },
  );
  private readonly fragment = toSignal(this.route.fragment, { initialValue: null });
  protected readonly chart = computed<Chart>(() => chartOf(this.fragment()));
  /** The pull-request and log skies share one view; Issues keeps its own. */
  private readonly skyView = signal<SkyView>('map');
  protected readonly view = computed<SkyView>(() => {
    const chart = this.chart();
    if (chart === 'issues') return this.issues.view();
    return isListOnly(chart) ? 'list' : this.skyView();
  });
  protected readonly skyChart = computed((): SkyChart => {
    const chart = this.chart();
    return chart === 'logs' || chart === 'issues' ? chart : 'prs';
  });
  /** The issue bar docks above the nursery. */
  protected readonly docked = computed(() => this.chart() === 'issues' && this.view() === 'map');
  protected readonly filter = signal<string | null>(null);
  protected readonly showCollisions = signal(true);
  /** Whether the merge plan is drawn and listed. */
  protected readonly planOn = signal(false);
  /** Whether the agent report cards are open; they and the plan never show at once. */
  protected readonly agentsOn = signal(false);
  /** Whether the Done list is open; it shares the right edge with the plan and the agents. */
  protected readonly doneOn = signal(false);
  /** The finished work the Done list has lit on the spiral. */
  protected readonly doneLit = signal<string | null>(null);
  /** The one kind of finished work the Done list shows, or null for all. */
  protected readonly doneOnly = signal<DoneKind | null>(null);
  /** Everything finished in the last 60 days: the ledger's pull requests and the closed issues. */
  protected readonly done = computed(() => doneWork(this.ledger.ledger(), this.issues.report()));
  /** The unclaimed issues passing through, and whether they are shown. */
  protected readonly showComets = signal(true);
  protected readonly selectedComet = signal<Comet | null>(null);
  protected readonly comets = computed(() => cometsOf(this.issues.report(), this.now().getTime()));
  protected readonly folded = signal(false);
  protected readonly refreshing = signal(false);
  /** The pull request whose star is selected, its card open. */
  protected readonly openPull = signal<number | null>(null);
  /** The pull request whose full screen is open. */
  readonly sheetPull = signal<number | null>(null);
  /** The open screen's head as last looked at, kept from when it opened: the look
   *  it records moves the queue's copy on to the head it shows. */
  protected readonly sheetLookedSha = signal<string | null>(null);
  protected readonly SNOOZE_DAYS = SNOOZE_DAYS;
  protected readonly sky = viewChild<StarmapSky>('sky');
  /** The help that fits the screen and view on show, as pr-starmap keys it. */
  protected readonly helpScreen = computed((): HelpKey =>
    isListOnly(this.chart())
      ? (`${this.chart()}-list` as HelpKey)
      : (`${this.chart()}-${this.view()}` as HelpKey),
  );

  protected readonly state = this.feed.state;
  private readonly report = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.report : null;
  });
  /** Dismissed and snoozed pull requests leave the sky, as on pr-starmap. */
  protected readonly items = computed(() =>
    (this.report()?.items ?? []).filter((item) => item.hidden === null),
  );
  /** The queue on screen: the live one, or a past refresh while replaying. */
  protected readonly shownItems = computed((): readonly QueueItem[] => {
    const replay = this.memory.replay();
    return replay ? replay.items.map((i) => this.replayed(i)) : this.items();
  });
  protected readonly skyItems = computed(() => this.shownItems().map(skyItemOf));
  /** The queue as it is now has changed since you looked; a replayed refresh has not. */
  protected readonly meteors = computed((): readonly Meteor[] =>
    this.memory.replay() ? [] : meteorsOf(this.repo(), this.items()),
  );
  /** Stacked pull requests, snoozed and dismissed ones included, as the crew's API reads them:
   *  what each is stacked on, what is stacked on it, and a merged base. */
  protected readonly stacks = computed((): Stacks => {
    if (this.memory.replay()) return NO_STACKS;
    return stacksOf(this.report()?.items ?? [], this.ledger.ledger()?.mergedBranches ?? []);
  });
  /** Open work against the viewer's limit, from the live queue even while replaying. */
  protected readonly wip = computed(() =>
    wipCheck(this.report()?.items ?? [], this.wipLimit.limit()),
  );
  /** The notice speaks for the live queue, so a replay hides it. */
  protected readonly showWipNotice = computed(
    () => this.chart() === 'prs' && this.wip().isOver && !this.memory.replay(),
  );
  /** The sky's news, as its layer reads it. */
  protected readonly skyNews = computed(() => {
    const news = this.memory.news();
    return { events: news.events, acknowledged: news.acknowledged };
  });
  protected readonly skyPairs = computed(() =>
    this.memory.replay() ? [] : (this.collisions.report()?.pairs ?? []).map(skyPairOf),
  );
  protected readonly title = computed(() => titleOf(this.chart()));
  protected readonly chips = computed(() => {
    const chart = this.chart();
    if (chart === 'issues') return this.issues.chips();
    return chart === 'prs' ? [...queueChips(this.skyItems()), this.cometChip()] : [];
  });
  /** The comets' own chip: it shows and hides them rather than filtering the stars. */
  private readonly cometChip = computed((): LegendChip => {
    const total = this.issues.report()?.total.comets ?? 0;
    return {
      id: COMETS,
      colour: COMET_COLOUR,
      count: total,
      text: `unclaimed issue${total === 1 ? '' : 's'}`,
      live: total > 0,
      pressed: this.showComets() && total > 0,
      title: total > COMET_CAP ? `The ${COMET_CAP} idlest are drawn` : 'Show or hide the comets',
    };
  });
  /** What the legend has narrowed the screen to. */
  protected readonly legendFilter = computed(() =>
    this.chart() === 'issues' ? this.issues.filter() : this.filter(),
  );
  /** The open pull requests the queue knows, for the issues' chips. */
  protected readonly openPulls = computed(() => openPullsOf(this.report()?.items ?? []));
  /** The Issues tab as the nursery lays it out. */
  protected readonly nurseryInput = computed(() => {
    const report = this.issues.report();
    if (this.chart() !== 'issues' || !report) return null;
    const open = new Set(this.openPulls().keys());
    return nurseryInputOf(report, this.issues.tab(), open, untracked(this.now).getTime());
  });
  private readonly usageDocument = computed(() => {
    const state = this.usage.state();
    return state.status === 'ready' ? state.document : null;
  });
  protected readonly stamp = computed(() => {
    const report = this.report();
    if (this.chart() === 'usage') return usageStamp(this.usageDocument());
    if (this.chart() === 'retro') return retroStamp(this.repo(), this.ledger.ledger());
    if (this.chart() === 'issues') return this.issues.stamp();
    if (this.chart() !== 'prs') return '';
    const replay = this.memory.replay();
    const repo = report?.repo ?? this.repo();
    if (replay) {
      return `replay · ${repo} · ${replay.items.length} open as of ${new Date(replay.at).toLocaleString()} · ] steps forward, Live returns`;
    }
    return queueStamp(
      report?.repo ?? this.repo(),
      this.items().length,
      report?.generatedAt ?? null,
    );
  });
  /** How old the sky is, as fog: by the data's age, or at once when refreshes fail. */
  protected readonly fog = computed(() => {
    if (this.chart() === 'issues') return this.issues.fog();
    const report = this.report();
    if (!report || this.memory.replay()) return 0;
    const now = this.now();
    return Math.max(fogLevel(report.generatedAt, now), queueFog(this.state(), now.getTime()));
  });
  protected readonly stale = computed(() => {
    if (this.chart() === 'usage') return this.usageFog();
    if (this.chart() === 'issues') return this.issues.stale();
    const state = this.state();
    const report = this.report();
    if (!report || this.memory.replay()) return null;
    if (state.status === 'ready' && state.isStale) return 'refresh failing';
    const now = this.now();
    return fogLevel(report.generatedAt, now) > 0
      ? `fogged · ${ageWords(report.generatedAt, now)} old`
      : null;
  });
  /** Usage fogs by its own age, as the queue does by the queue's. */
  private readonly usageFog = computed(() => {
    const generatedAt = this.usageDocument()?.generatedAt;
    const now = this.now();
    return generatedAt && fogLevel(generatedAt, now) > 0
      ? `fogged · ${ageWords(generatedAt, now)} old`
      : null;
  });
  protected readonly skyState = computed((): SkyState | null => {
    const chart = this.chart();
    if (chart === 'logs') return this.view() === 'map' ? this.logs.message() : null;
    if (chart === 'issues') return this.view() === 'map' ? this.issues.skyMessage() : null;
    if (chart !== 'prs' || this.view() === 'list') return null;
    const { status } = this.state();
    if (status === 'reading') return { headline: 'Reading the sky…' };
    if (status === 'unreachable') {
      return {
        headline: 'The queue is out of reach.',
        detail: 'Is the API running? Start it with npm start.',
      };
    }
    if (status === 'refused') return { headline: 'That is not a repository this page can read.' };
    if (!this.items().length) {
      return { headline: 'The queue is clear.', detail: 'Nothing is waiting on you.' };
    }
    return null;
  });

  private readonly readAt = computed(() => this.report()?.generatedAt ?? null);
  /** pr-starmap's changes panel: while there is unseen news on the queue's map. */
  /** pr-starmap's merge plan, over every open pull request and every pair. */
  protected readonly plan = computed(() =>
    mergePlan(
      this.items().map((item) => ({
        number: item.number,
        title: item.title,
        head: item.branch,
        base: item.base,
        mergeable: item.mergeable,
        additions: item.additions,
        deletions: item.deletions,
      })),
      (this.collisions.report()?.pairs ?? []).map(skyPairOf),
    ),
  );
  /** The plan's steps that still have a star to point at. */
  protected readonly planSteps = computed(() => {
    const shown = new Set(this.skyItems().map((item) => item.pr));
    return this.plan().filter((step) => shown.has(step.pr));
  });
  protected readonly planMarks = computed(() =>
    this.planSteps().map((step) => ({ pr: step.pr, needsRebase: step.reason === 'needs-rebase' })),
  );
  /** Until the collisions are read the plan is only a size order, so it is left out. */
  private readonly planOrder = computed(() =>
    this.collisions.report() ? this.plan().map((step) => step.pr) : [],
  );
  /** The pull request to work next in the live queue, whatever is on show. */
  private readonly queueNext = computed(() => nextStar(this.items(), this.planOrder()));
  /** What Next star opens: during a sprint, the sprint's next pull request not yet opened. */
  protected readonly next = computed(() => {
    if (!this.sprint.isRunning()) return this.queueNext();
    const prs = new Set(this.sprint.prs());
    const reviewed = this.sprint.reviewed();
    const left = this.items().filter((item) => prs.has(item.number) && !reviewed.has(item.number));
    return nextStar(left, this.planOrder());
  });
  /** Each sprint length, filled from the queue with Next star's pick leading. */
  protected readonly sprintOptions = computed(() =>
    sprintOptions(this.items(), this.queueNext()?.pr ?? null),
  );
  protected readonly sprintRows = computed(() =>
    sprintRows(this.sprint.sprint()?.picks ?? [], this.sprint.reviewed(), mergedOf(this.done())),
  );
  protected readonly sprintTotalMs = computed(() => {
    const sprint = this.sprint.sprint();
    return sprint ? sprint.endsAt - sprint.startedAt : 0;
  });
  /** A legend chip or an agent narrows the sky; otherwise a sprint lights its own stars. */
  protected readonly skyFilter = computed(
    () => this.filter() ?? (this.sprint.sprint() ? SPRINT_FILTER : null),
  );
  protected readonly litPrs = computed(() =>
    this.skyFilter() === SPRINT_FILTER ? this.sprint.prs() : this.agentPrs(),
  );
  protected readonly conflicting = computed(
    () =>
      (this.collisions.report()?.pairs ?? []).filter((p) => (p.conflicts ?? []).length > 0).length,
  );
  /** The plan's panel takes the right edge while it is on, over the queue's map. */
  /** The report cards take the right edge while they are on, over the queue's map. */
  protected readonly showAgents = computed(
    () =>
      this.agentsOn() && this.chart() === 'prs' && this.view() === 'map' && !this.memory.replay(),
  );
  /** The lit agent, from an `agent:` filter. */
  protected readonly litAgent = computed(() => {
    const filter = this.filter();
    return filter?.startsWith(AGENT_FILTER) ? filter.slice(AGENT_FILTER.length) : null;
  });
  /** The lit agent's pull requests, for the sky. */
  protected readonly agentPrs = computed(
    () => this.agents.report()?.agents.find((a) => a.agent === this.litAgent())?.prs ?? [],
  );
  protected readonly showDone = computed(
    () => this.doneOn() && this.chart() === 'prs' && this.view() === 'map' && !this.memory.replay(),
  );
  protected readonly showPlan = computed(
    () =>
      !this.agentsOn() &&
      !this.doneOn() &&
      this.planOn() &&
      this.chart() === 'prs' &&
      this.view() === 'map' &&
      !this.memory.replay() &&
      this.collisions.report() !== null,
  );
  protected readonly showChanges = computed(() => {
    const news = this.memory.news();
    return (
      !this.showPlan() &&
      !this.showAgents() &&
      !this.showDone() &&
      this.chart() === 'prs' &&
      this.view() === 'map' &&
      news.events.length > 0 &&
      !news.acknowledged
    );
  });
  /** The timeline under the queue's map, once the ledger has days to show. */
  protected readonly showTimeline = computed(
    () =>
      this.chart() === 'prs' &&
      this.view() === 'map' &&
      (this.memory.ledger()?.rows.length ?? 0) > 1,
  );
  protected readonly openItem = computed(
    () => this.shownItems().find((each) => each.number === this.openPull()) ?? null,
  );
  /** The star the queue sky rings: an open screen's or issue's, else the card's. */
  protected readonly ringedPull = computed(() =>
    ringedPull(
      { card: this.openPull(), sheet: this.sheetPull(), issue: this.issues.windowIssue() },
      this.shownItems(),
    ),
  );
  /** The comet the queue sky rings: an open issue's, else the picked one. */
  protected readonly ringedComet = computed(() =>
    ringedComet(this.issues.windowIssue(), this.comets(), this.selectedComet()),
  );
  /** What the open window is tied to on the sky by a line. */
  protected readonly tether = computed(() =>
    tetherOf(
      this.skyChart(),
      { card: this.openPull(), sheet: this.sheetPull(), issue: this.issues.windowIssue() },
      this.shownItems(),
      this.comets(),
    ),
  );
  /** The crews out in this repository, drawn as ships by their stars. */
  protected readonly crewMarks = computed(() => crewMarksOf(this.crew.crews(), this.repo()));
  /** The open issues, for the search; it finds closed ones on the Done list. */
  private readonly searchIssues = computed(
    (): readonly SearchedIssue[] => this.issues.report()?.open ?? [],
  );
  protected readonly suggestions = computed(() =>
    searchSuggestions(this.shownItems(), this.searchIssues(), this.done()),
  );
  /** What the last search said when it found nothing. */
  protected readonly searchMiss = signal<string | null>(null);
  /** The body the nursery rings: an open issue's, else the card's. */
  protected readonly ringedIssue = computed(
    () => this.issues.windowIssue() ?? this.issues.picked()?.issue?.number ?? null,
  );
  /** What the rest of the sky says about the selected pull request, for its card. */
  protected readonly cardContext = computed((): CardContext => {
    const number = this.openPull();
    const groups = binaries(this.skyItems(), (item) => item.issues);
    const replay = this.memory.replay();
    const news = this.memory.news();
    const event = news.events.find((e) => e.pr === number && EFFECTS[e.kind].onStar);
    const live = this.items().some((item) => item.number === number);
    return {
      replay: replay
        ? { at: replay.at, now: live ? 'still open' : this.fateNow(number ?? 0), live }
        : undefined,
      change: event
        ? { noun: EFFECTS[event.kind].noun, label: news.label, colour: EFFECTS[event.kind].colour }
        : undefined,
      planStep: this.planStepOf(number),
      staleAfterDays: this.blackHole.staleAfterDays(),
      stack: number === null ? undefined : this.stacks().get(number),
      pairs: this.skyPairs(),
      binaries: groups
        .filter((g) => g.members.some((item) => item.pr === number))
        .map((g) => ({
          issue: g.issue,
          others: g.members.map((item) => item.pr).filter((pr) => pr !== number),
        })),
    };
  });
  private readonly sheetItem = computed(
    () => this.items().find((each) => each.number === this.sheetPull()) ?? null,
  );
  protected readonly sheetBucket = computed(() => {
    const item = this.sheetItem();
    return item ? shownBucket(item) : null;
  });
  protected readonly sheetTitle = computed(() => this.sheetItem()?.title ?? null);
  protected readonly sheetLanded = computed(() => {
    const number = this.sheetPull();
    return number === null ? null : (this.stacks().get(number)?.landed ?? null);
  });
  protected readonly sheetFlaky = computed(() => this.sheetItem()?.flakyChecks ?? NO_FLAKY_CHECKS);
  /** The meteor record shows under the Log Sky's map, when it has days. */
  protected readonly showMeteors = computed(
    () => this.chart() === 'logs' && this.view() === 'map' && this.logs.hasDays(),
  );
  protected readonly insets = computed((): SkyInsets => {
    const wide = (this.window?.innerWidth ?? 0) > SIDE_PANEL_MIN_WIDTH;
    return {
      top: this.docked()
        ? TOP_INSET_WITH_DOCK
        : TOP_INSET +
          (this.chart() === 'prs' ? SEARCH_HEIGHT : 0) +
          (this.showWipNotice() ? WIP_NOTICE_HEIGHT : 0),
      bottom: this.showMeteors() || this.showTimeline() ? BOTTOM_INSET_WITH_STRIP : BOTTOM_INSET,
      side: !wide
        ? 0
        : this.showPlan() || this.showAgents() || this.showDone()
          ? PLAN_PANEL_WIDTH
          : this.showChanges()
            ? SIDE_PANEL_WIDTH
            : 0,
    };
  });

  constructor() {
    effect(() => {
      const repo = this.repo();
      untracked(() => {
        this.filter.set(null);
        this.openPull.set(null);
        this.sheetPull.set(null);
        this.sprint.close();
      });
      if (repo === '/') return;
      untracked(() => {
        this.memory.watch(repo);
        this.feed.watch(repo);
        this.logs.clear();
        this.logs.watch(repo);
        this.issues.watch(repo);
        this.openLinked();
      });
    });
    this.issues.openAt(this.fragment());
    // The Issues tab lives in the address too, so Back and a shared link keep it.
    effect(() => {
      const fragment = this.issues.fragment();
      if (this.chart() !== 'issues') return;
      untracked(() => this.navigateTo(fragment));
    });
    // The drone measures the sky on show: blocked pull requests, or faults still
    // burning; the issues leave it where it was.
    effect(() => {
      const chart = this.chart();
      const blocked =
        chart === 'prs'
          ? this.skyItems().filter((item) => BLOCKED.has(item.bucket)).length
          : chart === 'logs'
            ? this.logs.layout().stars.filter((star) => star.urgent).length
            : null;
      if (blocked !== null) untracked(() => this.sound.setTension(blocked));
    });
    // A refresh lays the Log Sky out again; the card and threads follow their fault.
    effect(() => {
      this.logs.layout();
      untracked(() => this.logs.follow());
    });
    // Once the queue and its frames are both in, what changed plays on the sky.
    effect(() => {
      const report = this.report();
      if (!report || !this.memory.framesLoaded()) return;
      untracked(() => {
        const events = this.memory.announce(report.generatedAt, this.items().map(memoryItemOf));
        if (events.length) this.sky()?.fit();
        this.sky()?.play(events);
      });
    });
    // Replay lays the sky out before its news plays, as pr-starmap refreshed then played.
    this.memory.onPlay = (events) => setTimeout(() => this.sky()?.play(events));
    effect(() => {
      if (!this.readAt()) return;
      untracked(() => {
        this.history.load(this.repo());
        this.ledger.load(this.repo());
        this.collisions.load(this.repo());
        this.agents.load(this.repo());
        this.refreshing.set(false);
      });
    });
  }

  /** Switches screen by the address, so Back and a shared link keep it. */
  protected setChart(chart: Chart): void {
    // Replay belongs to the queue sky; every other sky is the present.
    this.memory.endReplay();
    this.filter.set(null);
    this.openPull.set(null);
    this.searchMiss.set(null);
    this.logs.clear();
    this.logs.filter.set(null);
    this.issues.leave();
    this.navigateTo(chart === 'issues' ? this.issues.fragment() : fragmentOf(chart));
  }

  private navigateTo(fragment: string | undefined): void {
    if ((this.fragment() ?? undefined) === fragment) return;
    void this.router.navigate([], { relativeTo: this.route, fragment, replaceUrl: true });
  }

  protected setView(view: SkyView): void {
    if (this.chart() !== 'issues') return this.skyView.set(view);
    this.issues.setView(view);
    // The nursery is laid out from the data the list was showing; it arrives now.
    if (view === 'map') this.sky()?.arriveNursery();
  }

  /** Reads an issue in the issue window; one window, this or a PR screen, at a time. */
  protected openIssue(number: number): void {
    this.sheetPull.set(null);
    this.issues.windowIssue.set(number);
  }

  /** A legend chip narrows the sky to itself; pressing it again shows everything. */
  protected toggleFilter(id: string): void {
    if (id === COMETS) {
      this.showComets.update((shown) => !shown);
      this.selectedComet.set(null);
      return;
    }
    if (this.chart() === 'logs') {
      this.logs.toggleFilter(id as LogKey);
      return;
    }
    if (this.chart() === 'issues') {
      this.issues.toggleComets();
      return;
    }
    this.filter.update((current) => (current === id ? null : id));
    this.openPull.set(null);
  }

  /** Flies to a fault from the log list, opens its card and traces it. */
  protected goToLog(star: LogStar): void {
    this.skyView.set('map');
    this.logs.pick(star);
    this.sky()?.goToLog(star);
  }

  /** Flies to a star from the list, and opens it. */
  /** A meteor landed on its star: a quiet crackle, panned to where the star sits. */
  protected meteorLanded({ pan, strength, pr }: MeteorLanding): void {
    this.sound.crackle(pan, strength, pr);
  }

  /** A click on the sky: a star opens its pull request's screen; empty sky closes its card. */
  protected pick(number: number | null): void {
    this.selectedComet.set(null);
    this.openPull.set(number);
    const item = this.skyItems().find((each) => each.pr === number);
    if (!item) return;
    this.sound.ping(BLOCKED.has(item.bucket), item.pr);
    this.openSheet(item.pr);
  }

  /** A star rested on: its card, unless a full screen is already open over the sky. */
  protected preview(number: number): void {
    if (this.coveredByScreen()) return;
    this.selectedComet.set(null);
    this.openPull.set(number);
  }

  protected pickLog(star: LogStar | null): void {
    this.logs.pick(star);
    if (star) this.sound.ping(star.urgent);
  }

  /** A click on the nursery: an issue's body opens its card, as a star does. */
  protected pickIssue(star: IssueStar | null): void {
    this.issues.picked.set(star);
    if (star) this.sound.ping(false);
  }

  /** A click on a comet opens its issue, with the soft tone a picked star gives. */
  protected pickComet(comet: Comet): void {
    this.openPull.set(null);
    this.selectedComet.set(comet);
    this.sound.ping(false);
    this.openIssue(comet.issue);
  }

  /** A comet rested on: its card, unless a full screen is already open over the sky. */
  protected previewComet(comet: Comet): void {
    if (this.coveredByScreen()) return;
    this.openPull.set(null);
    this.selectedComet.set(comet);
  }

  /** Whether a PR screen or issue window is open, so hovering the sky behind it changes nothing. */
  private coveredByScreen(): boolean {
    return this.sheetPull() !== null || this.issues.windowIssue() !== null;
  }

  protected goTo(number: number): void {
    this.skyView.set('map');
    this.openPull.set(number);
    this.sky()?.goTo(number);
  }

  /** A search lands on its star or comet, with its card, or opens an issue with neither. */
  protected find(query: string): void {
    const found = findOnSky(query, this.shownItems(), this.searchIssues(), this.done());
    this.searchMiss.set(found ? null : `Nothing matches “${query.trim()}”.`);
    if (!found) return;
    if (found.kind === 'done') return this.findDone(found.item);
    if (found.kind === 'pull') {
      this.selectedComet.set(null);
      return this.flyTo(found.number);
    }
    const comet = this.comets().find((each) => each.issue === found.issue);
    if (found.kind === 'issue' || !comet) return this.openIssue(found.issue);
    this.skyView.set('map');
    this.showComets.set(true);
    this.openPull.set(null);
    this.selectedComet.set(comet);
  }

  /** Flies to a star with its card, showing every star first. */
  private flyTo(number: number): void {
    if (this.filter() === null) return this.goTo(number);
    // Clearing the legend's filter refits the sky; the flight waits for that.
    this.filter.set(null);
    setTimeout(() => this.goTo(number));
  }

  /** Next star: flies to the pick, lights it with its card, then opens its PR screen. */
  protected goToNext(): void {
    const next = this.next();
    if (!next) return;
    this.selectedComet.set(null);
    if (this.memory.replay()) {
      // The live sky is laid out again first; the flight waits for that.
      this.memory.endReplay();
      setTimeout(() => this.flyTo(next.pr));
    } else this.flyTo(next.pr);
    this.openSheetAfterHold(next.pr);
  }

  private openSheetAfterHold(number: number): void {
    this.nextHold?.unsubscribe();
    this.nextHold = timer(NEXT_STAR_HOLD_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // Picking another star or closing the card in the meantime cancels the screen.
        if (this.openPull() === number) this.openSheet(number);
      });
  }

  protected refresh(): void {
    if (this.chart() === 'usage') {
      this.usage.refresh();
      return;
    }
    this.refreshing.set(true);
    this.feed.refresh(this.repo(), true);
    this.issues.refresh(this.repo(), true);
  }

  /** A point on the timeline: the refresh there, or now. */
  protected scrub(index: number | null): void {
    if ((this.memory.replay()?.index ?? null) === index) return;
    this.memory.stopPlayer();
    this.openPull.set(null);
    this.memory.showFrame(index);
  }

  protected togglePlayer(): void {
    this.openPull.set(null);
    this.memory.togglePlayer(this.motion.isStill());
  }

  /** On the queue's sky, `n` goes to the next star and `[` and `]` step through the recorded refreshes. */
  protected onKey(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest(TYPING)) return;
    if (this.chart() !== 'prs' || this.sheetPull() !== null) return;
    if (event.key === 'n' && !hasModifier(event)) return this.goToNext();
    if (event.key !== '[' && event.key !== ']') return;
    this.openPull.set(null);
    this.memory.step(event.key === '[' ? -1 : 1);
  }

  /** Where a pull request shown in replay stands today. */
  private fateNow(pr: number): string {
    return knownFates(this.memory.frames(), this.memory.ledger()).get(pr) ?? 'no longer open';
  }

  /** A replayed pull request, filled out from the live queue while it is still open. */
  private replayed(item: MemoryItem): QueueItem {
    const live = this.items().find((each) => each.number === item.pr);
    const base: QueueItem = live ?? {
      number: item.pr,
      title: item.title,
      url: `https://github.com/${this.repo()}/pull/${item.pr}`,
      isDraft: false,
      bucket: 'unreviewed',
      closes: [],
      failingChecks: 0,
      flakyChecks: [],
      additions: null,
      deletions: null,
      idleDays: item.idleDays,
      ageDays: 0,
      branch: '',
      base: '',
      mergeable: 'UNKNOWN',
      changedFiles: null,
      isSeen: false,
      hidden: null,
      lookedSha: null,
      sinceLook: null,
    };
    const bucket = item.bucket === 'fresh' ? 'unreviewed' : item.bucket;
    return {
      ...base,
      title: item.title,
      bucket,
      isSeen: item.bucket === 'fresh',
      idleDays: item.idleDays,
    };
  }

  /** Where a pull request falls in the merge plan, as its card says. */
  private planStepOf(number: number | null): { step: number; of: number } | undefined {
    const plan = this.plan();
    const index = plan.findIndex((step) => step.pr === number);
    return index < 0 ? undefined : { step: index + 1, of: plan.length };
  }

  /** Merge plan: on, the panel takes the right edge and the numbered stars are framed beside it. */
  protected togglePlan(): void {
    this.planOn.update((on) => !on);
    if (this.planOn()) {
      this.closeAgents();
      this.closeDone();
    }
    setTimeout(() => this.sky()?.fit());
  }

  /** Agents: on, the report cards take the right edge; off, an agent's light goes out. */
  protected toggleAgents(): void {
    if (this.agentsOn()) this.closeAgents();
    else {
      this.agentsOn.set(true);
      this.planOn.set(false);
      this.closeDone();
    }
    setTimeout(() => this.sky()?.fit());
  }

  /** A card lights only that agent's stars; pressing it again shows everything. */
  protected lightAgent(agent: string): void {
    const id = AGENT_FILTER + agent;
    this.filter.update((current) => (current === id ? null : id));
    this.openPull.set(null);
    setTimeout(() => this.sky()?.fit());
  }

  /** Done: on, the list of finished work takes the right edge beside the spiral it lights. */
  protected toggleDone(): void {
    if (this.doneOn()) return this.closeDone();
    this.openDoneList();
  }

  private openDoneList(): void {
    this.doneOn.set(true);
    this.planOn.set(false);
    this.closeAgents();
  }

  /** Finished work a search found opens, with the Done list up and it lit on the spiral. */
  private findDone(item: DoneItem): void {
    this.skyView.set('map');
    this.openPull.set(null);
    this.selectedComet.set(null);
    this.openDoneList();
    if (this.doneOnly() !== item.kind) this.doneOnly.set(null);
    this.doneLit.set(item.key);
    this.openDone(item);
  }

  /** A finished pull request opens in the PR screen, a finished issue in the issue window. */
  protected openDone(item: DoneItem): void {
    if (isPull(item)) this.openSheet(item.number);
    else this.openIssue(item.number);
  }

  private closeDone(): void {
    this.doneOn.set(false);
    this.doneLit.set(null);
    this.doneOnly.set(null);
  }

  private closeAgents(): void {
    this.agentsOn.set(false);
    if (this.litAgent()) this.filter.set(null);
  }

  /** Esc closes the full screen first, then the card, as on pr-starmap. */
  protected closeTopmost(): void {
    if (this.sheetPull() !== null) this.sheetPull.set(null);
    else if (this.issues.windowIssue() !== null) this.issues.windowIssue.set(null);
    else if (this.selectedComet()) this.selectedComet.set(null);
    else if (this.chart() === 'issues') this.issues.picked.set(null);
    else if (this.chart() === 'logs') this.logs.closeCard();
    else this.openPull.set(null);
  }

  /** A link can open one change: `?issue=618` its window, `?pr=623` its screen,
   *  as Home's agent nudges do. Read after the repository's issues reset. */
  private openLinked(): void {
    const query = this.route.snapshot.queryParamMap;
    const issue = Number(query.get('issue'));
    const pull = Number(query.get('pr'));
    if (Number.isInteger(issue) && issue > 0) this.issues.windowIssue.set(issue);
    if (Number.isInteger(pull) && pull > 0) this.openSheet(pull);
  }

  /** Starts a review sprint: its stars light, the rest dim. */
  protected startSprint(option: SprintOption): void {
    this.sprint.start(option);
    this.filter.set(null);
    this.openPull.set(null);
  }

  /** Opens a pull request's full screen, from its card or another screen. */
  openSheet(number: number): void {
    this.sprint.markReviewed(number);
    this.issues.windowIssue.set(null);
    this.sheetLookedSha.set(this.items().find((each) => each.number === number)?.lookedSha ?? null);
    this.sheetPull.set(number);
  }

  /** The open screen shows `sha` as its head: the next look picks out what comes after it. */
  protected recordLook(number: number, sha: string): void {
    if (!this.session.canWrite() || this.memory.replay()) return;
    this.recordTriage(number, { action: 'look', sha });
  }

  /** Reads the queue again now, after GitHub took a rerun. */
  protected refreshQueue(): void {
    this.feed.refresh(this.repo());
  }

  protected recordTriage(number: number, choice: TriageChoice): void {
    const repo = this.repo();
    this.triage.record(repo, number, choice).subscribe(() => this.feed.refresh(repo));
  }
}

const hasModifier = (event: KeyboardEvent): boolean =>
  event.ctrlKey || event.metaKey || event.altKey;
