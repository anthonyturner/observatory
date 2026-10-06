import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  ErrorHandler,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { BinaryLayer } from '../engine/binary-layer';
import { CollisionLayer, SkyPair } from '../engine/collision-layer';
import { SkyEngine } from '../engine/sky-engine';
import { SkyLayout, layoutQueue } from '../engine/sky-layout';
import { SkyItem, SkyStar } from '../engine/sky-model';
import { ThreadLayer } from '../engine/thread-layer';
import { CometLayer, layoutComets } from '../engine/comet-layer';
import { PlanLayer, PlanMark } from '../engine/plan-layer';
import { TetherLayer, TetherTarget } from '../engine/tether-layer';
import { COMET_CAP, Comet } from '../comets';
import { NewsEvent, play } from '../memory/news';
import { News, NewsLayer } from '../memory/news-layer';
import { LogSkyLayout, LogStar } from '../../../core/logs/log-layout';
import { twinStars } from '../../../core/logs/log-trace';
import { feedLogs, logStarOf } from '../sky-logs';
import { IssueStar } from '../../issues/issue-look';
import { IssueNarrowing } from '../../issues/issue-list';
import { NurseryInput, issueStarOf } from '../nursery/nursery-layout';
import { NurserySky } from '../nursery/nursery-sky';
import { HoverDwell } from './hover-dwell';
import { DoneItem, DoneKind } from '../../../core/queue/done-work';
import { DoneLayer, isDoneHit } from '../engine/done-layer';
import { CrewLayer } from '../engine/crew-layer';
import { CrewMark } from '../../../core/crew/crew.types';

/** What the pointer can rest on over the queue: a star's pull request, or a comet. */
type QueueHover = number | Comet;
const hoverKey = (under: QueueHover): string =>
  typeof under === 'number' ? `pr${under}` : `issue${under.issue}`;

/** Which sky the engine draws. */
export type SkyChart = 'prs' | 'logs' | 'issues';

/** What the chrome takes off each edge, so Fit frames the sky between it. */
export interface SkyInsets {
  readonly top: number;
  readonly bottom: number;
  readonly side: number;
}

/** A filter that lights one agent's pull requests: `agent:<name>`. */
export const AGENT_FILTER = 'agent:';
/** The filter that lights a review sprint's pull requests. */
export const SPRINT_FILTER = 'sprint';

const DEFAULT_INSETS: SkyInsets = { top: 140, bottom: 70, side: 0 };
/** The open window a line ties to its star: the PR screen or the issue window. */
const TETHERED = '[data-tether]';
const TYPING_OR_DIALOG = 'input, textarea, select, [contenteditable], [role="dialog"]';
const PANS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * pr-starmap's star map: the review queue as constellations, drawn in 3D with
 * Three.js when the browser can, in Canvas 2D when it cannot. Resting the
 * pointer on a star or comet previews it; a click opens it. A finger has no
 * hover, so its first tap previews and a second tap opens.
 */
@Component({
  selector: 'app-starmap-sky',
  template: `<canvas
    #sky
    aria-label="Star map of the review queue"
    (pointermove)="onHover($event)"
    (pointerleave)="onHover(null)"
  ></canvas>`,
  styleUrl: './starmap-sky.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)', '(document:pointermove)': 'onDrag()' },
})
export class StarmapSky {
  /** Which sky: the review queue, the Log Sky, or the issues' nursery. */
  readonly chart = input<SkyChart>('prs');
  readonly items = input.required<readonly SkyItem[]>();
  readonly logLayout = input<LogSkyLayout | null>(null);
  /** The log star whose card is open, and the fault whose threads are drawn. */
  readonly selectedLog = input<LogStar | null>(null);
  readonly traced = input<LogStar | null>(null);
  /** The Issues screen's tab, laid out as the nursery. */
  readonly nursery = input<NurseryInput | null>(null);
  /** What the issue bar and legend narrow the nursery to. */
  readonly issueNarrowing = input<IssueNarrowing | null>(null);
  /** The issue whose card is open. */
  readonly selectedIssue = input<number | null>(null);
  /** The legend's filter: a bucket, `quick`, or none. */
  readonly filter = input<string | null>(null);
  /** The pull requests an `agent:` or sprint filter lights. */
  readonly litPrs = input<readonly number[]>([]);
  readonly selected = input<number | null>(null);
  readonly pairs = input<readonly SkyPair[]>([]);
  readonly showCollisions = input(true);
  /** Unclaimed issues passing through, and whether they are shown. */
  readonly comets = input<readonly Comet[]>([]);
  readonly showComets = input(true);
  readonly selectedComet = input<Comet | null>(null);
  /** Whether a past refresh is on screen: comets are the present, so they step aside. */
  readonly replaying = input(false);
  /** The merge plan's steps, drawn while it is on. */
  readonly plan = input<readonly PlanMark[]>([]);
  readonly planOn = input(false);
  /** What the open window is tied to by a line: the ringed star or comet. */
  readonly tether = input<TetherTarget | null>(null);
  /** The review queue's news: what changed, and whether it has been seen. */
  readonly news = input<News>({ events: [], acknowledged: false });
  /** 0 clear to 1 full. */
  readonly fog = input(0);
  readonly hidden = input(false);
  readonly insets = input<SkyInsets>(DEFAULT_INSETS);
  /** Finished pull requests and issues, for the Spiral of Done. */
  readonly done = input<readonly DoneItem[]>([]);
  /** The finished work the Done list has lit, by key. */
  readonly doneLit = input<string | null>(null);
  /** The one kind of finished work the Done list shows, or null for all. */
  readonly doneOnly = input<DoneKind | null>(null);
  /** Crews sent to fix pull requests, drawn as ships by their stars. */
  readonly crews = input<readonly CrewMark[]>([]);
  /** A star was clicked open, or empty sky (null). */
  readonly picked = output<number | null>();
  /** A star was rested on, or tapped once: show its card. */
  readonly previewed = output<number>();
  /** A log star was clicked, or empty sky (null), on the Log Sky. */
  readonly pickedLog = output<LogStar | null>();
  /** An issue's body was clicked, or empty sky (null), on the nursery. */
  readonly pickedIssue = output<IssueStar | null>();
  /** A comet was clicked open. */
  readonly pickedComet = output<Comet>();
  /** A comet was rested on, or tapped once: show its card. */
  readonly previewedComet = output<Comet>();
  /** A light on the Spiral of Done was clicked open. */
  readonly pickedDone = output<DoneItem>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('sky');
  private readonly document = inject(DOCUMENT);
  private readonly motion = inject(MotionPreference);
  private readonly errors = inject(ErrorHandler);
  private readonly collisions = new CollisionLayer();
  private readonly binaries = new BinaryLayer((star) => star.item?.issues ?? []);
  private readonly threads = new ThreadLayer();
  private readonly newsLayer = new NewsLayer();
  private readonly nurserySky = new NurserySky(this.document);
  private readonly cometLayer = new CometLayer<Comet>();
  private readonly planLayer = new PlanLayer();
  private readonly doneLayer = new DoneLayer();
  private readonly crewLayer = new CrewLayer(Date.now, () => this.engine?.kick());
  private readonly tetherLayer = new TetherLayer(
    () => this.document.querySelector(TETHERED)?.getBoundingClientRect() ?? null,
    () => this.cometLayer.selectedAt(),
  );
  private readonly hover = new HoverDwell<QueueHover>((settled) =>
    typeof settled === 'number' ? this.previewed.emit(settled) : this.previewedComet.emit(settled),
  );
  private engine: SkyEngine | null = null;
  private isFramed = false;
  /** The skies already framed once, so a data refresh keeps the viewer's camera. */
  private readonly framed = new Set<string>();

  constructor() {
    afterNextRender(() => this.start());
    inject(DestroyRef).onDestroy(() => {
      this.hover.cancel();
      this.crewLayer.dispose();
      this.engine?.dispose();
    });
    effect(() => {
      const chart = this.chart();
      const items = this.items();
      const logs = this.logLayout();
      const nursery = this.nursery();
      untracked(() => this.layOut(chart, items, logs, nursery));
    });
    effect(() => {
      const filter = this.filter();
      const prs = this.litPrs();
      const engine = this.engine;
      if (!engine || untracked(this.chart) === 'issues') return;
      engine.filter = filterFor(filter, prs);
      engine.fitsFiltered = true;
      untracked(() => engine.fit());
    });
    // Label and search only dim the nursery; its shape stays put. The comets
    // alone are a new disk, framed afresh.
    effect(() => {
      const narrowing = this.issueNarrowing();
      const engine = this.engine;
      if (!engine || !narrowing || untracked(this.chart) !== 'issues') return;
      if (!this.nurserySky.narrow(engine, narrowing)) return engine.kick();
      untracked(() => {
        this.nurserySky.layOut(engine, this.nursery(), false);
        this.select();
        engine.fit();
      });
    });
    effect(() => {
      this.doneLayer.set(this.done(), Date.now());
      this.doneLayer.lit = this.doneLit();
      this.doneLayer.only = this.doneOnly();
      this.doneLayer.clearRight = this.insets().side;
      this.engine?.kick();
    });
    effect(() => {
      this.selected();
      this.selectedLog();
      this.selectedIssue();
      this.traced();
      untracked(() => this.select());
    });
    effect(() => {
      this.cometLayer.comets = layoutComets(this.comets(), COMET_CAP);
      this.engine?.kick();
    });
    effect(() => {
      this.cometLayer.show = this.showComets();
      this.cometLayer.paused = this.replaying();
      this.planLayer.paused = this.replaying();
      this.planLayer.steps = this.plan();
      this.planLayer.on = this.planOn();
      this.cometLayer.selected = this.selectedComet();
      this.engine?.kick();
    });
    effect(() => this.crewLayer.set(this.crews()));
    effect(() => {
      this.tetherLayer.target = this.tether();
      this.engine?.kick();
    });
    effect(() => {
      this.newsLayer.news = this.news();
      this.engine?.kick();
    });
    effect(() => {
      this.collisions.pairs = this.pairs();
      this.collisions.showCollisions = this.showCollisions();
      const engine = this.engine;
      if (!engine) return;
      engine.fog = this.fog();
      engine.kick();
    });
    effect(() => {
      const hidden = this.hidden();
      this.engine?.setHidden(hidden);
    });
    effect(() => {
      this.motion.isStill();
      this.engine?.kick();
    });
  }

  zoomIn(): void {
    this.engine?.zoomIn();
  }

  zoomOut(): void {
    this.engine?.zoomOut();
  }

  fit(): void {
    this.engine?.fit();
  }

  /** Lays the nursery out afresh and frames it, as pressing Starmap on Issues does. */
  arriveNursery(): void {
    const engine = this.engine;
    if (!engine || this.chart() !== 'issues') return;
    this.nurserySky.layOut(engine, this.nursery(), false);
    this.select();
    engine.fit();
  }

  pan(dx: number, dy: number): void {
    this.engine?.pan(dx, dy);
  }

  /** Flies to a pull request's star, as a list row or a changes row does. */
  goTo(number: number): void {
    const star = this.engine?.skyStars.find((s) => s.item?.pr === number);
    if (star) this.engine?.goTo(star);
  }

  /** Plays each change's burst in turn, once the sky has finished arriving. */
  play(events: readonly NewsEvent[]): void {
    const engine = this.engine;
    if (!engine) return;
    play(events, engine.skyClusters, {
      now: performance.now() / 1000,
      entranceEnd: engine.entranceEnd(),
      frozen: engine.frozen,
    });
    engine.kick();
  }

  /** Flies to a fault's star, as a log list row does. */
  goToLog(logStar: LogStar): void {
    const star = this.engine?.skyStars.find((s) => s.data === logStar);
    if (star) this.engine?.goTo(star);
  }

  /** On the queue, a star or comet rested on is previewed; on the nursery,
   *  the body under the pointer is named. */
  protected onHover(event: PointerEvent | null): void {
    const engine = this.engine;
    if (!engine || this.hidden()) return;
    if (event?.buttons) return this.hover.cancel();
    if (this.chart() === 'prs') return this.hoverQueue(engine, event);
    if (this.chart() !== 'issues') return;
    if (!this.nurserySky.hover(engine, event?.clientX ?? null, event?.clientY ?? null)) return;
    this.canvas().nativeElement.style.cursor = this.nurserySky.isHovering ? 'pointer' : '';
    engine.kick();
  }

  private hoverQueue(engine: SkyEngine, event: PointerEvent | null): void {
    if (event?.pointerType === 'touch') return;
    const hit = event ? engine.hitAt(event.clientX, event.clientY) : null;
    // A light on the Spiral of Done names itself; it has no card to dwell for.
    const done = hit && 'other' in hit && isDoneHit(hit.other) ? hit.other.done : null;
    if (this.doneLayer.hoverOn(done)) engine.kick();
    if (done) {
      this.canvas().nativeElement.style.cursor = 'pointer';
      return this.hover.aim(null, null);
    }
    const under: QueueHover | null = !hit
      ? null
      : 'star' in hit
        ? (hit.star.item?.pr ?? null)
        : (hit.other as Comet);
    this.canvas().nativeElement.style.cursor = under === null ? '' : 'pointer';
    this.hover.aim(under === null ? null : hoverKey(under), under);
  }

  /** A dragged window takes its line with it, even on a still sky. */
  protected onDrag(): void {
    if (this.tetherLayer.target) this.engine?.kick();
  }

  /** + and − zoom, the arrows pan; keys typed into a field or a dialog are theirs. */
  protected onKey(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest(TYPING_OR_DIALOG)) return;
    if (this.hidden()) return;
    const pan = PANS[event.key];
    if (pan) {
      event.preventDefault();
      this.pan(pan[0], pan[1]);
    } else if (event.key === '+' || event.key === '=') {
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      this.zoomOut();
    }
  }

  private start(): void {
    const canvas = this.canvas().nativeElement;
    try {
      this.engine = new SkyEngine({
        document: this.document,
        canvas,
        frozen: () => this.motion.isStill(),
        insets: () => this.insets(),
        picked: (star: SkyStar | null, touch: boolean) => this.emitPicked(star, touch),
        loadWebGL: async (camera, onLost) => {
          const { WebGLSkyRenderer } = await import('../engine/webgl-sky');
          return new WebGLSkyRenderer(
            this.document,
            canvas,
            camera,
            () => ({
              width: this.document.defaultView?.innerWidth ?? 0,
              height: this.document.defaultView?.innerHeight ?? 0,
            }),
            onLost,
          );
        },
        pickedOther: (thing, touch) =>
          isDoneHit(thing)
            ? this.pickedDone.emit(thing.done)
            : this.emitComet(thing as Comet, touch),
        failed: (error) => this.errors.handleError(error),
      });
    } catch (error) {
      // A browser without a 2D canvas (a test's) draws nothing.
      this.errors.handleError(error);
      return;
    }
    this.engine.layers = [
      this.cometLayer,
      this.collisions,
      this.binaries,
      this.threads,
      this.newsLayer,
      this.planLayer,
      this.nurserySky.layer,
      this.tetherLayer,
      this.doneLayer,
      this.crewLayer,
    ];
    this.engine.filter = filterFor(this.filter(), this.litPrs());
    this.engine.fog = this.fog();
    this.engine.setHidden(this.hidden());
    this.layOut(this.chart(), this.items(), this.logLayout(), this.nursery());
  }

  private emitPicked(star: SkyStar | null, touch: boolean): void {
    const chart = this.chart();
    if (chart === 'logs') return this.pickedLog.emit(logStarOf(star));
    if (chart === 'issues') return this.pickedIssue.emit(issueStarOf(star));
    this.hover.cancel();
    const pr = star?.item?.pr ?? null;
    if (pr !== null && touch && this.selected() !== pr) this.previewed.emit(pr);
    else this.picked.emit(pr);
  }

  private emitComet(comet: Comet, touch: boolean): void {
    this.hover.cancel();
    if (touch && this.selectedComet()?.issue !== comet.issue) this.previewedComet.emit(comet);
    else this.pickedComet.emit(comet);
  }

  /** Lays out the sky on screen. Within one sky stars glide to their new places;
   *  switching skies draws the new one fresh and frames it. */
  private layOut(
    chart: SkyChart,
    items: readonly SkyItem[],
    logs: LogSkyLayout | null,
    nursery: NurseryInput | null,
  ): void {
    const engine = this.engine;
    if (!engine) return;
    const switched = engine.chart !== chart;
    engine.chart = chart;
    let newDisk = false;
    if (chart === 'issues') {
      const narrowing = untracked(this.issueNarrowing);
      if (narrowing) this.nurserySky.narrow(engine, narrowing);
      newDisk = this.nurserySky.layOut(engine, nursery, this.isFramed && !switched);
    } else {
      this.nurserySky.clear();
      engine.filter = filterFor(untracked(this.filter), untracked(this.litPrs));
      engine.fitsFiltered = true;
      if (chart === 'logs') {
        engine.setSky((sky: SkyLayout) => logs && feedLogs(logs, sky));
      } else {
        engine.setSky((sky: SkyLayout) => layoutQueue(items, sky), {
          carry: this.isFramed && !switched,
        });
      }
    }
    this.select();
    const count = engine.skyStars.length;
    if (count && (switched || newDisk || !this.framed.has(chart))) {
      engine.fit();
      this.framed.add(chart);
      this.isFramed = true;
    }
  }

  /** Rings the selected star, and traces the fault in focus to its twins. */
  private select(): void {
    const engine = this.engine;
    if (!engine) return;
    const stars = engine.skyStars;
    const selectedLog = this.selectedLog();
    if (engine.chart === 'issues') {
      engine.selected = this.nurserySky.selected(engine, this.selectedIssue());
    } else {
      engine.selected =
        engine.chart === 'logs'
          ? (stars.find((s) => s.data === selectedLog && selectedLog !== null) ?? null)
          : (stars.find((s) => s.item?.pr === this.selected()) ?? null);
    }
    const traced = this.traced();
    const tracedStar = traced ? stars.find((s) => s.data === traced) : undefined;
    const twins = new Set(twinStars(traced, this.logLayout()?.stars ?? []));
    this.threads.trace = tracedStar
      ? { traced: tracedStar, twins: stars.filter((s) => twins.has(s.data as LogStar)) }
      : null;
    engine.kick();
  }
}

/** A legend filter as a test on a star: a bucket, the quick wins across them,
 *  or the pull requests an agent or the sprint lights. */
export function filterFor(
  filter: string | null,
  litPrs: readonly number[] = [],
): ((star: SkyStar) => boolean) | null {
  if (!filter) return null;
  if (filter === 'quick') return (star) => !!star.quick;
  if (filter === SPRINT_FILTER || filter.startsWith(AGENT_FILTER)) {
    const prs = new Set(litPrs);
    return (star) => prs.has(star.item?.pr ?? -1);
  }
  return (star) => star.key === filter;
}
