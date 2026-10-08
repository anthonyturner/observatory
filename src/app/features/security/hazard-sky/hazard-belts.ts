import { seededRandom } from '../../../core/instrument/seeded-random';
import { hashString } from '../../../core/orrery/world-layout';
import {
  ALERT_KINDS,
  AlertKind,
  AlertSeverity,
  SEVERITIES,
  SecurityAlert,
  SecurityReport,
} from '../../../core/security/security-report';
import { Stage } from '../../releases/release-sky/release-path';

/** One mark in the sky: an alert, or, for a preview visitor, one counted without its details. */
export interface Hazard {
  readonly key: string;
  readonly kind: AlertKind;
  readonly severity: AlertSeverity;
  readonly alert: SecurityAlert | null;
}

export interface PlacedHazard {
  readonly key: string;
  readonly hazard: Hazard;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** On the belt's near half, so drawn in front of the world. */
  readonly isNear: boolean;
  /** 0 to 1, fixed per hazard: its shape, tumble and pulse. */
  readonly seed: number;
}

/** One grade's belt: an ellipse round the world, tilted toward the viewer. */
export interface PlacedBelt {
  readonly severity: AlertSeverity;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly count: number;
}

export interface BeltLayout {
  readonly centre: { readonly x: number; readonly y: number };
  readonly worldRadius: number;
  /** Worst grade innermost, closest to the world. */
  readonly belts: readonly PlacedBelt[];
  readonly hazards: readonly PlacedHazard[];
}

/** More than this and the belts only thicken; the list still holds every alert. */
export const MAX_HAZARDS = 240;
/** A belt's height over its width: seen from a little above its plane. */
export const BELT_TILT = 0.36;
/** The outer belt keeps this share of the stage, so its marks and glows fit. */
const STAGE_FILL = 0.92;
const WORLD_SHARE = 0.2;
const MIN_WORLD_PX = 22;
const MAX_WORLD_PX = 90;
/** The worst belt sits this many world radii out. */
const INNER_BELT = 1.75;
/** How far a hazard may stray across its belt, and along it, as shares of a gap. */
const RADIAL_JITTER = 0.12;
const ALONG_JITTER = 0.5;
/** A far-side hazard closer to the world's centre than this many radii would hide behind it. */
const HIDDEN_REACH = 1.15;
/** Far-side hazards shrink to this share of a near one's size. */
const FAR_SCALE = 0.8;

/** A hazard's size on screen, in px, by grade: the worse, the bigger. */
export const HAZARD_PX: Readonly<Record<AlertSeverity, number>> = {
  critical: 9,
  high: 7,
  medium: 5.5,
  low: 4,
};

/** Each alert as a hazard; a visitor's counts as hazards of their grade without details. */
export function hazardsOf(report: SecurityReport): Hazard[] {
  const hazards = report.isWithheld
    ? countedHazards(report)
    : report.alerts.map((alert) => ({
        key: `${alert.kind}-${alert.number}`,
        kind: alert.kind,
        severity: alert.severity,
        alert,
      }));
  return hazards.slice(0, MAX_HAZARDS);
}

function countedHazards(report: SecurityReport): Hazard[] {
  return SEVERITIES.flatMap((severity) =>
    ALERT_KINDS.flatMap((kind) => {
      const count = report.sources.find((source) => source.kind === kind)?.counts[severity] ?? 0;
      return Array.from({ length: count }, (_, index) => ({
        key: `${kind}-${severity}-${index}`,
        kind,
        severity,
        alert: null,
      }));
    }),
  );
}

/** A hazard's size: its grade's, smaller on the far side of its belt. */
export const hazardRadius = (severity: AlertSeverity, isNear: boolean): number =>
  HAZARD_PX[severity] * (isNear ? 1 : FAR_SCALE);

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly isNear: boolean;
}

function spotOn(
  layout: Omit<BeltLayout, 'belts' | 'hazards'>,
  belt: PlacedBelt,
  angle: number,
  stretch: number,
): Spot {
  const { centre, worldRadius } = layout;
  const at = (turn: number): Spot => ({
    x: centre.x + Math.cos(turn) * belt.radiusX * stretch,
    y: centre.y + Math.sin(turn) * belt.radiusY * stretch,
    isNear: Math.sin(turn) >= 0,
  });
  const spot = at(angle);
  const isHidden =
    !spot.isNear && Math.hypot(spot.x - centre.x, spot.y - centre.y) < worldRadius * HIDDEN_REACH;
  // Mirrored onto the near half, so no alert sits out of sight behind the world.
  return isHidden ? at(-angle) : spot;
}

/**
 * Lays each grade out as a belt round the project's world, worst innermost,
 * its hazards spread evenly along it from a starting turn fixed per project.
 */
export function layoutBelts(hazards: readonly Hazard[], stage: Stage, repo: string): BeltLayout {
  const centre = { x: stage.left + stage.width / 2, y: stage.top + stage.height / 2 };
  const outer = Math.max(0, Math.min(stage.width / 2, stage.height / 2 / BELT_TILT) * STAGE_FILL);
  const worldRadius = Math.min(MAX_WORLD_PX, Math.max(MIN_WORLD_PX, outer * WORLD_SHARE));
  const inner = Math.min(outer, worldRadius * INNER_BELT);
  const step = (outer - inner) / (SEVERITIES.length - 1);
  const belts = SEVERITIES.map((severity, index) => ({
    severity,
    radiusX: inner + step * index,
    radiusY: (inner + step * index) * BELT_TILT,
    count: hazards.filter((hazard) => hazard.severity === severity).length,
  }));
  const frame = { centre, worldRadius };
  const random = seededRandom(hashString(repo));
  const placed = belts.flatMap((belt) => {
    const onBelt = hazards.filter((hazard) => hazard.severity === belt.severity);
    const gap = (Math.PI * 2) / Math.max(1, onBelt.length);
    const start = random() * Math.PI * 2;
    return onBelt.map((hazard, index): PlacedHazard => {
      const angle = start + gap * (index + (random() - 0.5) * ALONG_JITTER);
      const stretch = 1 + (random() - 0.5) * RADIAL_JITTER;
      const spot = spotOn(frame, belt, angle, stretch);
      return {
        key: hazard.key,
        hazard,
        ...spot,
        radius: hazardRadius(hazard.severity, spot.isNear),
        seed: random(),
      };
    });
  });
  return { centre, worldRadius, belts, hazards: placed };
}
