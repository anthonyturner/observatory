import { Issue, IssuesReport } from '../../../core/issues/issues-report';
import { OTHER_ARM } from '../../issues/issue-inks';
import { IssueStar, Look } from '../../issues/issue-look';
import { fmtN } from '../starmap-view';
import { rnd } from '../engine/rnd';
import { SkyLayout } from '../engine/sky-layout';
import { SkyCluster, SkyStar, WORLD } from '../engine/sky-model';

/* pr-starmap's issue sky. A pull request is a star: work lit and waiting to
   merge. An issue is the step before, gas that has not lit yet, so the issues
   are a stellar nursery: a slowly turning spiral disk round the project's core.
   Each of the most-used labels is an arm in its label's colour; distance from
   the core is how long an issue has sat idle, on a log scale so one ancient
   issue does not crush the rest into the middle. */

/** The disk: inner and outer radius, how flat it lies, how tightly the arms wind, how fast it turns. */
export const NURSERY = { r0: 150, r1: 880, tilt: 0.58, wind: 1.35, spin: 0.01 } as const;
const ARM_CAP = 6;
const DAY_MS = 86_400_000;
/** Closed work sinks toward the core across this many days, and dims across them. */
const CLOSED_WINDOW_DAYS = 60;
const MIN_IDLE_SCALE_DAYS = 30;
/** Dark label colours are mixed toward white until they carry on the night sky. */
const DARK_LUMINANCE = 0.45;
const DARK_MIX = 0.7;
const LABEL_HEX = /^[0-9a-f]{6}$/i;

/** What an issue's body carries, besides the star it is. */
export interface NurseryBody {
  readonly issue: Issue;
  readonly look: Look;
  /** Where it sits on the disk before the disk turns. */
  readonly theta0: number;
  readonly rad: number;
  readonly jetAngle: number;
  /** The open pull requests on it, one jet each. */
  readonly jets: readonly number[];
  /** 1, or less for older closed work. */
  readonly fade: number;
}

/** A spiral arm: its constellation and where round the disk it starts. */
export interface NurseryArm {
  readonly cluster: SkyCluster;
  readonly base: number;
}

export interface NurseryInput {
  readonly list: readonly Issue[];
  readonly closedTab: boolean;
  /** How far back the closed list reaches. */
  readonly days: number;
  /** The pull requests the queue has open; empty before it is read. */
  readonly openPulls: ReadonlySet<number>;
  readonly now: number;
}

/** What `layoutIssues` leaves for the layer that turns and draws the disk. */
export interface Nursery {
  readonly arms: readonly NurseryArm[];
  /** Unlabelled issues, drifting round the disk on no arm. */
  readonly halo: SkyCluster;
}

/** One tab of a report as the nursery lays it out. */
export function nurseryInputOf(
  report: IssuesReport,
  tab: 'open' | 'closed',
  openPulls: ReadonlySet<number>,
  now: number,
): NurseryInput {
  return { list: report[tab], closedTab: tab === 'closed', days: report.days, openPulls, now };
}

/** A label colour bright enough to read on the night sky: GitHub allows black. */
export function skyInk(color: string): string {
  if (!LABEL_HEX.test(color)) return OTHER_ARM;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(color.slice(i, i + 2), 16));
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const k = lum < DARK_LUMINANCE ? ((DARK_LUMINANCE - lum) / DARK_LUMINANCE) * DARK_MIX : 0;
  const mix = (v: number): string =>
    Math.round(v + (255 - v) * k)
      .toString(16)
      .padStart(2, '0');
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}

/** A point on the tilted disk. */
export const polar = (theta: number, rad: number): [number, number] => [
  WORLD.w / 2 + Math.cos(theta) * rad,
  WORLD.h / 2 + Math.sin(theta) * rad * NURSERY.tilt,
];

/** The angle an arm has reached at a radius: a logarithmic spiral. */
export const armTheta = (base: number, rad: number): number =>
  base + NURSERY.wind * Math.log(Math.max(rad, NURSERY.r0 * 0.5) / NURSERY.r0);

/** The body a sky star stands for, if it is an issue's. */
export const bodyOf = (star: SkyStar | null): NurseryBody | null =>
  star?.kind === 'issue' ? (star.data as NurseryBody) : null;

/** The issue a sky star stands for, as its card shows it. */
export function issueStarOf(star: SkyStar | null): IssueStar | null {
  const body = bodyOf(star);
  return star && body
    ? { issue: body.issue, look: body.look, jets: body.jets, colour: star.colour }
    : null;
}

const daysSince = (iso: string, now: number): number =>
  Math.max(0, Math.floor((now - Date.parse(iso)) / DAY_MS));

/** The labels that lead the most issues, most first, then by name, so an arm
 *  keeps its place while the list changes around it. */
function leadingLabels(list: readonly Issue[]): string[] {
  const lead = new Map<string, number>();
  for (const issue of list) {
    const first = issue.labels[0];
    if (first) lead.set(first.name, (lead.get(first.name) ?? 0) + 1);
  }
  return [...lead]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, ARM_CAP)
    .map(([name]) => name);
}

/** The arm an issue sits on by its first label: a leading one, `''` for the
 *  shared arm, or null for the halo. */
function armNameOf(issue: Issue, top: readonly string[]): string | null {
  const first = issue.labels[0];
  if (!first) return null;
  return top.includes(first.name) ? first.name : '';
}

const issuesWord = (n: number): string => `${fmtN(n)} ISSUE${n === 1 ? '' : 'S'}`;

function makeArms(list: readonly Issue[], top: readonly string[]): Map<string, NurseryArm> {
  const names = list.some((issue) => armNameOf(issue, top) === '') ? [...top, ''] : [...top];
  const counts = new Map<string, number>();
  for (const issue of list) {
    const name = armNameOf(issue, top);
    if (name !== null) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return new Map(
    names.map((name, k) => {
      const label = list.find((issue) => issue.labels[0]?.name === name)?.labels[0];
      const cluster: SkyCluster = {
        arm: true,
        cx: 0,
        cy: 0,
        z: 0,
        labelY: 0,
        colour: name ? skyInk(label?.color ?? '') : OTHER_ARM,
        label: name || 'other labels',
        sub: issuesWord(counts.get(name) ?? 0),
        stars: [],
      };
      return [name, { cluster, base: (k / Math.max(names.length, 1)) * Math.PI * 2 }];
    }),
  );
}

/** Only a close recorded as completed is finished work; not planned, a
 *  duplicate, or no reason at all is dust, never a star. */
function lookOf(issue: Issue): Look {
  if (issue.closedAt) return issue.stateReason === 'COMPLETED' ? 'settled' : 'dust';
  return issue.comet ? 'globule' : 'protostar';
}

/** Size is age, so the oldest untouched gas is the heaviest. */
function magOf(look: Look, ageDays: number): number {
  if (look === 'globule') return 3 + Math.min(Math.sqrt(ageDays) * 0.9, 12);
  if (look === 'protostar') return 4 + Math.min(Math.sqrt(ageDays) * 0.6, 8);
  return 2.5 + Math.min(Math.sqrt(ageDays) * 0.35, 4);
}

/** The open pull requests on an issue. `prs` also carries GitHub's own links,
 *  which can include merged ones; a queue not read yet leaves them all. */
function jetsOf(issue: Issue, openPulls: ReadonlySet<number>): readonly number[] {
  const live = issue.prs.filter((n) => openPulls.has(n));
  return live.length ? live : issue.prs;
}

/** Distance from the core: idleness on a log scale, or for closed work, how
 *  recently it closed, sinking toward the core as it ages out of the window. */
function radiusOf(input: NurseryInput, maxIdle: number): (issue: Issue) => number {
  const { r0, r1 } = NURSERY;
  return (issue) => {
    if (!input.closedTab) {
      const idle = daysSince(issue.updatedAt, input.now);
      return r0 + ((r1 - r0) * Math.log1p(idle)) / Math.log1p(maxIdle);
    }
    const days = input.days || CLOSED_WINDOW_DAYS;
    const d = Math.min(daysSince(issue.closedAt ?? issue.updatedAt, input.now), days) / days;
    return r0 * 0.55 + (r1 * 0.8 - r0 * 0.55) * (1 - d);
  };
}

/** Lays one tab's issues out as pr-starmap's nursery, body for body. */
export function layoutIssues(input: NurseryInput, sky: SkyLayout): Nursery | null {
  const { list, now } = input;
  if (!list.length) return null;
  const top = leadingLabels(list);
  const arms = makeArms(list, top);
  const halo: SkyCluster = {
    arm: true,
    halo: true,
    cx: 0,
    cy: 0,
    z: 0,
    labelY: 0,
    colour: OTHER_ARM,
    label: '',
    sub: '',
    stars: [],
  };
  sky.clusters.push(...[...arms.values()].map((arm) => arm.cluster), halo);
  const maxIdle = Math.max(
    MIN_IDLE_SCALE_DAYS,
    ...list.map((issue) => daysSince(issue.updatedAt, now)),
  );
  const radius = radiusOf(input, maxIdle);

  for (const issue of list) {
    const r = rnd((issue.number * 2654435761) % 2147483647);
    const name = armNameOf(issue, top);
    const arm = name === null ? null : (arms.get(name) ?? null);
    const rad = Math.max(40, radius(issue) + (r() - 0.5) * 46);
    const theta = arm ? armTheta(arm.base, rad) + (r() - 0.5) * 0.32 : r() * Math.PI * 2;
    const look = lookOf(issue);
    const [x, y] = polar(theta, rad);
    const cluster = arm?.cluster ?? halo;
    const body: NurseryBody = {
      issue,
      look,
      theta0: theta,
      rad,
      jetAngle: r() * Math.PI,
      jets: look === 'protostar' ? jetsOf(issue, input.openPulls) : [],
      // The widest part of the fade is the whole window: a week-old close is bright.
      fade: issue.closedAt
        ? 1 -
          (0.65 * Math.min(daysSince(issue.closedAt, now), CLOSED_WINDOW_DAYS)) / CLOSED_WINDOW_DAYS
        : 1,
    };
    const star = sky.makeStar(
      {
        kind: 'issue',
        custom: true,
        key: issue.comet ? 'comet' : look,
        urgent: false,
        tag: `#${issue.number}`,
        caption: issue.title,
        x,
        y,
        mag: magOf(look, daysSince(issue.createdAt, now)),
        colour: cluster.colour,
        cluster,
        data: body,
      },
      r,
      3 + r() * 3,
    );
    star.z = 0;
    star.az = 0;
  }
  return { arms: [...arms.values()], halo };
}
