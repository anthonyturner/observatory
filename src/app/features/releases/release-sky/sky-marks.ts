import { BUMP_WORDS, dateWords, mergedWords, pullCountWords, weekWords } from '../release-words';
import { PlacedComet, PlacedRelease, PlacedWeek, TimelineLayout } from './release-layout';
import { Stage, pathAt } from './release-path';

/** A star or the comet's head as a button over the canvas, so it can be hovered, focused and picked. */
export interface BodyMark {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  /** The button's width and height, never smaller than a finger. */
  readonly hit: number;
  /** Shown under it when there is room, else null. */
  readonly name: string | null;
  readonly date: string | null;
  /** Shown on hover and focus: version, date and count. */
  readonly tip: string;
  /** What a screen reader says for it. */
  readonly spoken: string;
}

/** A week's name beside its knot in the tail. */
export interface WeekMark {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly text: string;
}

export interface SkyMarks {
  /** Oldest first, the comet last: the order Tab takes. */
  readonly bodies: readonly BodyMark[];
  readonly weeks: readonly WeekMark[];
}

const MIN_HIT_PX = 32;
const HIT_PER_RADIUS = 2.4;
/** A week's name sits this far out from the edge of its knot. */
const WEEK_LABEL_GAP_PX = 14;
/** Week names need this much room along the screen, and half of it inside the stage. */
const WEEK_LABEL_ROOM_PX = 150;
const WEEK_LABEL_HALF_PX = 75;

/** A centred name kept from running off either side of the stage. */
const clampInside = (x: number, stage: Stage): number =>
  Math.min(
    Math.max(x, stage.left + WEEK_LABEL_HALF_PX),
    stage.left + stage.width - WEEK_LABEL_HALF_PX,
  );

const hitOf = (radius: number): number => Math.max(MIN_HIT_PX, radius * HIT_PER_RADIUS);

function releaseMark(release: PlacedRelease): BodyMark {
  const date = dateWords(release.publishedAt);
  const kind = release.isPrerelease ? 'Prerelease' : BUMP_WORDS[release.bump];
  return {
    key: release.key,
    x: release.x,
    y: release.y,
    hit: hitOf(release.radius),
    name: release.hasLabel ? release.tag : null,
    date: release.hasLabel ? date : null,
    tip: `${release.tag} · ${date} · ${pullCountWords(release.count)}`,
    spoken: `${release.tag}: ${kind.toLowerCase()}, ${date}, ${mergedWords(release.count)}`,
  };
}

function cometMark(comet: PlacedComet): BodyMark {
  return {
    key: comet.key,
    x: comet.x,
    y: comet.y,
    hit: hitOf(comet.radius),
    name: 'Unreleased',
    date: pullCountWords(comet.count),
    tip: `Unreleased · ${pullCountWords(comet.count)} since the last release`,
    spoken: `Unreleased: ${mergedWords(comet.count)} not in a release yet`,
  };
}

/** Each week's name out to the side of its knot, the newest always, older ones where they fit. */
function weekMarks(weeks: readonly PlacedWeek[], stage: Stage): WeekMark[] {
  let lastX = Infinity;
  const marks: WeekMark[] = [];
  for (const week of [...weeks].reverse()) {
    const point = pathAt(week.t, stage);
    const out = week.spread + WEEK_LABEL_GAP_PX;
    const x = clampInside(point.x + point.dy * out, stage);
    if (lastX - x < WEEK_LABEL_ROOM_PX) continue;
    lastX = x;
    marks.push({
      key: week.key,
      x,
      y: point.y - point.dx * out,
      text: `${weekWords(week.start)} · ${week.count}`,
    });
  }
  return marks.reverse();
}

/** The buttons and names the sky lays over its canvas. */
export function skyMarks(layout: TimelineLayout, stage: Stage): SkyMarks {
  const { releases, comet } = layout;
  const bodies = releases.map(releaseMark);
  return comet
    ? { bodies: [...bodies, cometMark(comet)], weeks: weekMarks(comet.weeks, stage) }
    : { bodies, weeks: [] };
}
