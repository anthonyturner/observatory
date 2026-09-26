import { clamp01 } from './easing';

/** Where the core sits on the screen and how big it is, in CSS pixels. */
export interface CoreView {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly centreX: number;
  readonly centreY: number;
  readonly radius: number;
  /** How much of the core is still on screen, 1 to 0 as it scrolls away. */
  readonly lift: number;
  readonly isAway: boolean;
  /** From the core's centre down to the window's bottom before any scrolling,
   *  rounded so a phone's toolbar sliding in and out does not rebuild the floor. */
  readonly floorDepth: number;
}

export interface AnchorBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface WindowBox {
  readonly width: number;
  readonly height: number;
  readonly scrollY: number;
  readonly pixelRatio: number;
}

const MIN_RADIUS = 36;
const MAX_RADIUS = 175;
const MAX_PIXEL_RATIO = 2;
/** A window shorter than this still lays the floor out as if it were this tall. */
const FLOOR_MIN_WINDOW = 640;
const FLOOR_STEP = 80;
const FLOOR_OVERRUN = 40;

export function coreRadius(anchor: AnchorBox): number {
  return Math.max(MIN_RADIUS, Math.min(anchor.height * 0.34, anchor.width * 0.36, MAX_RADIUS));
}

/** The view for an anchor box measured in the viewport. */
export function coreViewOf(anchor: AnchorBox, viewport: WindowBox): CoreView {
  const radius = coreRadius(anchor);
  const bottom = anchor.top + anchor.height;
  const isAway = bottom < radius * 0.2 || anchor.top > viewport.height;
  const poleY = anchor.top + viewport.scrollY + anchor.height / 2;
  const unscrolledDepth = Math.max(viewport.height, FLOOR_MIN_WINDOW) - poleY + FLOOR_OVERRUN;
  return {
    width: viewport.width,
    height: viewport.height,
    pixelRatio: Math.min(viewport.pixelRatio || 1, MAX_PIXEL_RATIO),
    centreX: anchor.left + anchor.width / 2,
    centreY: anchor.top + anchor.height / 2,
    radius,
    lift: isAway ? 0 : clamp01((bottom - radius * 0.2) / (anchor.height * 0.8)),
    isAway,
    floorDepth: Math.max(radius * 2, Math.ceil(unscrolledDepth / FLOOR_STEP) * FLOOR_STEP),
  };
}
