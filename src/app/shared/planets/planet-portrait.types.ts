import { WorldKind } from '../../core/orrery/world-kind';
import { StarType } from '../gl/star-shader';

/** A world's image spans this many of its radii each side of its centre, room for its air. */
export const WORLD_FRAME = 1.2;
/** A sun's image spans this many of its radii each side, room for its corona. */
export const SUN_FRAME = 2.4;

/** One world to paint, lit from one side. */
export interface WorldPortrait {
  readonly kind: WorldKind;
  readonly seed: number;
  /** The air's colour, as an `r, g, b` triple. */
  readonly air: string;
  /** A unit vector toward the sun, in the image's y-down plane. */
  readonly towardSun: { readonly x: number; readonly y: number };
  /** The image's width and height, in pixels. */
  readonly px: number;
}

/** A sun to paint, drawn as the review queue draws a star close up. */
export interface SunPortrait {
  readonly type: StarType;
  /** Its colour, as an `r, g, b` triple. */
  readonly ink: string;
  readonly px: number;
}

/** Paints worlds and suns into image URLs. */
export interface PortraitPainter {
  world(portrait: WorldPortrait): string;
  sun(portrait: SunPortrait): string;
  dispose(): void;
}
