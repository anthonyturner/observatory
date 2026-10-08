import { dopplerOf, listenerOf } from '../sound/doppler';
import { starRadius } from './canvas-sky';
import { rnd } from './rnd';
import { SkyFrame, SkyLayer } from './sky-frame';

/** A pull request whose head has new commits since it was last looked at. */
export interface Meteor {
  /** The page stays up as the viewer moves between projects, so a number alone does not name it. */
  readonly repo: string;
  readonly pr: number;
  /** How many commits, or null when the branch was rewritten and they cannot be counted. */
  readonly commits: number | null;
}

/** What the layer needs of a queue item to find its meteor. */
export interface Looked {
  readonly number: number;
  readonly sinceLook: { readonly newCommits: number | null } | null;
}

/** A rewritten branch has no count; it is shown as a few commits' worth. */
const REWRITTEN_AS = 3;
/** Commits at which a meteor is as bright and long-tailed as it gets (2^4 − 1). */
const FULL_AT = 15;
export const METEOR_CAP = 12;

/** 0 to 1, rising by halves with each doubling of the commits. */
export function strengthOf(commits: number | null): number {
  const count = commits ?? REWRITTEN_AS;
  return Math.min(1, Math.log2(1 + Math.max(count, 0)) / Math.log2(1 + FULL_AT));
}

/** One meteor for each pull request with new commits since you looked; when
 *  there are more than the sky should carry, the biggest changes keep theirs. */
export function meteorsOf(repo: string, items: readonly Looked[], cap = METEOR_CAP): Meteor[] {
  return items
    .flatMap(({ number, sinceLook }) =>
      sinceLook ? [{ repo, pr: number, commits: sinceLook.newCommits }] : [],
    )
    .sort((a, b) => strengthOf(b.commits) - strengthOf(a.commits) || a.pr - b.pr)
    .slice(0, cap);
}

/** What a landing already shown is told apart by, so a refresh never replays it. */
export const meteorKey = ({ repo, pr, commits }: Meteor): string =>
  `${repo}#${pr}:${commits ?? 'rewritten'}`;

/** How a meteor looks: more commits, a longer and brighter streak. */
export function meteorLook(commits: number | null): {
  readonly tailPx: number;
  readonly brightness: number;
} {
  const strength = strengthOf(commits);
  return { tailPx: 70 + 130 * strength, brightness: 0.55 + 0.45 * strength };
}

/** Which way a meteor comes from: always from above, never flat, the same for a pull request every time. */
export function meteorHeading(pr: number): { readonly x: number; readonly y: number } {
  const angle = -Math.PI * (0.18 + 0.64 * rnd(pr * 9157 + 31)());
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

/** Where the show begins and ends, in seconds from the sky settling. */
const LEAD_S = 0.6;
const STAGGER_S = 0.45;
export const FLIGHT_S = 1.1;
export const GLINT_S = 1.0;
/** How far above its star a meteor starts, in pixels. */
const TRAVEL_PX = 240;
/** A frame this long is a stall, not time passing. */
const MAX_STEP_S = 0.25;

export type MeteorStage = 'waiting' | 'flying' | 'glinting' | 'gone';

/** Where a meteor that started at `startAt` stands at `elapsed`, and how far through that stage. */
export function meteorStage(
  elapsed: number,
  startAt: number,
): { readonly stage: MeteorStage; readonly p: number } {
  const age = elapsed - startAt;
  if (age < 0) return { stage: 'waiting', p: 0 };
  if (age < FLIGHT_S) return { stage: 'flying', p: age / FLIGHT_S };
  if (age < FLIGHT_S + GLINT_S) return { stage: 'glinting', p: (age - FLIGHT_S) / GLINT_S };
  return { stage: 'gone', p: 1 };
}

/** How far the head is from its star's centre: it falls faster as it comes, and stops at the rim. */
export const headDistance = (rim: number, p: number): number => rim + TRAVEL_PX * (1 - p * p);

/** Where a star stands for a meteor that means to land on it. */
export type StarState = 'ready' | 'arriving' | 'absent';

export interface Flight {
  readonly meteor: Meteor;
  readonly stage: 'flying' | 'glinting';
  readonly p: number;
}

/**
 * The order the meteors play in: each waits for its star to have arrived, then
 * takes the next free slot, so a busy day reads as a sequence and a refresh
 * that changes nothing plays nothing.
 */
export class MeteorShow {
  private elapsed = 0;
  private cursor = LEAD_S;
  private entries: { meteor: Meteor; startAt: number | null; landed: boolean }[] = [];
  private readonly seen = new Set<string>();

  get busy(): boolean {
    return this.entries.length > 0;
  }

  /** Makes these the meteors wanted: queues those not already shown, and drops any
   *  waiting or in flight that no longer are, as when the viewer moves to another project. */
  set(meteors: readonly Meteor[]): void {
    const wanted = new Set(meteors.map(meteorKey));
    this.entries = this.entries.filter((entry) => wanted.has(meteorKey(entry.meteor)));
    for (const meteor of meteors) {
      const key = meteorKey(meteor);
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      this.entries.push({ meteor, startAt: null, landed: false });
    }
  }

  /** Moves on by `dt` seconds: what is in flight, and what has just landed. */
  advance(
    dt: number,
    starState: (pr: number) => StarState,
  ): { readonly flights: Flight[]; readonly landed: Meteor[] } {
    this.elapsed += dt;
    this.entries = this.entries.filter((entry) => starState(entry.meteor.pr) !== 'absent');
    const flights: Flight[] = [];
    const landed: Meteor[] = [];
    for (const entry of this.entries) {
      if (entry.startAt === null && starState(entry.meteor.pr) === 'ready') {
        entry.startAt = Math.max(this.cursor, this.elapsed + LEAD_S);
        this.cursor = entry.startAt + STAGGER_S;
      }
      if (entry.startAt === null) continue;
      const { stage, p } = meteorStage(this.elapsed, entry.startAt);
      if (stage === 'waiting') continue;
      if (stage !== 'flying' && !entry.landed) {
        entry.landed = true;
        landed.push(entry.meteor);
      }
      if (stage !== 'gone') flights.push({ meteor: entry.meteor, stage, p });
    }
    this.entries = this.entries.filter(
      (entry) =>
        entry.startAt === null || meteorStage(this.elapsed, entry.startAt).stage !== 'gone',
    );
    return { flights, landed };
  }
}

/** Where a meteor landed, for the sound: left to right as it sits on screen. */
export interface MeteorLanding {
  readonly pr: number;
  /** −1 (left) to 1 (right). */
  readonly pan: number;
  /** 0 to 1: how big the change was. */
  readonly strength: number;
  /** The Doppler factor of its fall; 1 when motion is off and it did not move. */
  readonly doppler: number;
}

/** The speakers' share of a screen x, kept short of the extremes so a landing never sits in one ear. */
export const panOf = (x: number, width: number): number =>
  width > 0 ? Math.max(-1, Math.min(1, (x / width) * 2 - 1)) * 0.8 : 0;

/** How far from a star's centre a meteor stops: just outside its rim, so it never hides the star. */
const rimOf = (radius: number): number => radius * 1.15 + 2;

/** The head of a meteor falling on a star at (x, y), at `p` through its flight. */
const headAt = (
  x: number,
  y: number,
  rim: number,
  heading: { readonly x: number; readonly y: number },
  p: number,
): { readonly x: number; readonly y: number; readonly z: number } => {
  const away = headDistance(rim, p);
  return { x: x + heading.x * away, y: y + heading.y * away, z: 0 };
};

/** The last stretch of the fall that the landing's pitch is read from, in seconds. */
const LANDING_WINDOW_S = 0.05;

/** A star this far off screen is out of sight, and its landing out of earshot. */
const OFF_SCREEN_PX = 300;
const isNear = (f: SkyFrame, x: number, y: number): boolean =>
  x > -OFF_SCREEN_PX &&
  y > -OFF_SCREEN_PX &&
  x < f.width + OFF_SCREEN_PX &&
  y < f.height + OFF_SCREEN_PX;

const HEAD = '255, 244, 214';
const EMBER = '255, 170, 90';
const REDRAW_MS = 50;

/**
 * The since-look meteors: a streak that falls onto the star of each pull
 * request with new commits, then a glint on the star. Drawn flat over both
 * renderers, always outside the star's rim so it never hides the star. It
 * starts once the sky has arrived and runs on the scene's clock; with motion
 * off there is no streak, only the glint, which a still sky needs redrawing
 * for until it is over.
 */
export class MeteorLayer implements SkyLayer {
  private readonly show = new MeteorShow();
  private armed = false;
  private lastT = 0;
  private lastWall = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly redraw: () => void,
    private readonly landed: (landing: MeteorLanding) => void,
  ) {}

  set(meteors: readonly Meteor[]): void {
    this.show.set(meteors);
    this.redraw();
  }

  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  flat(ctx: CanvasRenderingContext2D, f: SkyFrame): void {
    if (f.chart !== 'prs' || !this.show.busy) return;
    if (!this.armed) {
      if (!f.stars.length || !f.stars.every((star) => f.born(star) >= 1)) return;
      this.armed = true;
      this.lastT = f.t;
      this.lastWall = f.wall;
    }
    const { flights, landed } = this.show.advance(this.step(f), (pr) => {
      const star = f.stars.find((each) => each.item?.pr === pr);
      return !star ? 'absent' : f.born(star) >= 1 ? 'ready' : 'arriving';
    });
    for (const meteor of landed) this.announce(f, meteor);
    for (const flight of flights) this.draw(ctx, f, flight);
    if (f.frozen && this.show.busy) this.later();
  }

  /** Seconds since the last frame, on the scene's clock, or the wall's while it stands still. */
  private step(f: SkyFrame): number {
    const dt = f.frozen ? f.wall - this.lastWall : f.t - this.lastT;
    this.lastT = f.t;
    this.lastWall = f.wall;
    return Math.min(Math.max(dt, 0), MAX_STEP_S);
  }

  private announce(f: SkyFrame, meteor: Meteor): void {
    const star = f.stars.find((each) => each.item?.pr === meteor.pr);
    if (!star) return;
    const [x, y] = f.toScreen(star.ax, star.ay, star.az);
    if (!isNear(f, x, y)) return;
    const rim = rimOf(starRadius(f, star, 1));
    const heading = meteorHeading(meteor.pr);
    // With motion off there is no streak, so nothing fell and nothing shifts.
    const doppler = f.frozen
      ? 1
      : dopplerOf(
          headAt(x, y, rim, heading, 1 - LANDING_WINDOW_S / FLIGHT_S),
          headAt(x, y, rim, heading, 1),
          LANDING_WINDOW_S,
          listenerOf(f.width, f.height),
        );
    this.landed({
      pr: meteor.pr,
      pan: panOf(x, f.width),
      strength: strengthOf(meteor.commits),
      doppler,
    });
  }

  private later(): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.redraw();
    }, REDRAW_MS);
  }

  private draw(ctx: CanvasRenderingContext2D, f: SkyFrame, { meteor, stage, p }: Flight): void {
    const star = f.stars.find((each) => each.item?.pr === meteor.pr);
    if (!star) return;
    const [x, y] = f.toScreen(star.ax, star.ay, star.az);
    if (!isNear(f, x, y)) return;
    const { tailPx, brightness } = meteorLook(meteor.commits);
    const alpha = brightness * f.dim(star);
    const radius = starRadius(f, star, 1);
    const rim = rimOf(radius);
    ctx.save();
    if (stage === 'flying') {
      if (!f.frozen)
        streak(ctx, { x, y, rim, p, tailPx, alpha, heading: meteorHeading(meteor.pr) });
    } else {
      glint(ctx, { x, y, rim, radius, p, alpha, still: f.frozen, pr: meteor.pr });
    }
    ctx.restore();
  }
}

interface Streak {
  readonly x: number;
  readonly y: number;
  readonly rim: number;
  readonly p: number;
  readonly tailPx: number;
  readonly alpha: number;
  readonly heading: { readonly x: number; readonly y: number };
}

function streak(ctx: CanvasRenderingContext2D, s: Streak): void {
  const { x: headX, y: headY } = headAt(s.x, s.y, s.rim, s.heading, s.p);
  const fade = Math.min(1, s.p / 0.2) * s.alpha;
  const tail = ctx.createLinearGradient(
    headX,
    headY,
    headX + s.heading.x * s.tailPx,
    headY + s.heading.y * s.tailPx,
  );
  tail.addColorStop(0, `rgba(${HEAD}, ${fade})`);
  tail.addColorStop(1, `rgba(${EMBER}, 0)`);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = tail;
  ctx.lineWidth = 1.6 + 1.4 * s.alpha;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(headX, headY);
  ctx.lineTo(headX + s.heading.x * s.tailPx, headY + s.heading.y * s.tailPx);
  ctx.stroke();
  ctx.fillStyle = `rgba(${HEAD}, ${fade})`;
  ctx.beginPath();
  ctx.arc(headX, headY, 2 + 1.6 * s.alpha, 0, Math.PI * 2);
  ctx.fill();
}

interface Glint {
  readonly x: number;
  readonly y: number;
  readonly rim: number;
  readonly radius: number;
  readonly p: number;
  readonly alpha: number;
  readonly still: boolean;
  readonly pr: number;
}

const SPARKS = 6;

/** A brightening that fades over the star, adding light to it rather than covering it; with
 *  motion on, a ring spreads from the rim and a few sparks fly off. */
function glint(ctx: CanvasRenderingContext2D, g: Glint): void {
  const left = 1 - g.p;
  const reach = g.rim * 2 + 8;
  const glow = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, reach);
  glow.addColorStop(0, `rgba(${HEAD}, ${0.55 * g.alpha * left * left})`);
  glow.addColorStop(1, `rgba(${EMBER}, 0)`);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(g.x, g.y, reach, 0, Math.PI * 2);
  ctx.fill();
  if (g.still) return;
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${HEAD}, ${0.7 * g.alpha * left})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(g.x, g.y, g.rim + g.p * g.radius * 1.6, 0, Math.PI * 2);
  ctx.stroke();
  const r = rnd(g.pr * 6151 + 7);
  ctx.strokeStyle = `rgba(${EMBER}, ${0.8 * g.alpha * left})`;
  ctx.beginPath();
  for (let i = 0; i < SPARKS; i++) {
    const angle = r() * Math.PI * 2;
    const from = g.rim + g.p * (8 + r() * 14);
    const to = from + 3 + 5 * left;
    ctx.moveTo(g.x + Math.cos(angle) * from, g.y + Math.sin(angle) * from);
    ctx.lineTo(g.x + Math.cos(angle) * to, g.y + Math.sin(angle) * to);
  }
  ctx.stroke();
}
