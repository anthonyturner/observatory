import { CameraPose, Viewport } from '../../../core/orrery/orrery-camera';

/* Where the Orrery's Milky Way is, in one place: its shader draws the band from
   these numbers, and the shipped specks are placed in it with the same ones,
   so a speck always sits in the band and turns with it. */

/** The band's direction across the sky, before the sky turns: x, then y. */
export const BAND_ALONG_X = 1;
export const BAND_ALONG_Y = 0.38;
/** How far the band sits off the centre, so the busy middle stays on darker sky. */
export const BAND_OFFSET = 0.24;
/** The sky turns this many radians a second: once round in about an hour and a half. */
export const SKY_TURN = 0.0012;
/** How much the band shifts and grows with the camera: far, so very little. */
export const SKY_PARALLAX = 0.00004;
export const SKY_ZOOM_POWER = 0.12;

/** What the band's place on screen depends on this frame. */
export interface SkyView {
  readonly view: Viewport;
  readonly camera: CameraPose;
  /** Scene seconds. */
  readonly time: number;
}

/** The uniforms the shader takes, worked out once for both it and the specks. */
export function skyUniforms({ view, camera, time }: SkyView) {
  return {
    aspect: view.width / Math.max(1, view.height),
    zoom: Math.pow(camera.scale, SKY_ZOOM_POWER),
    turn: time * SKY_TURN,
    driftX: camera.x * SKY_PARALLAX,
    driftY: -camera.y * SKY_PARALLAX,
  };
}

const length = Math.hypot(BAND_ALONG_X, BAND_ALONG_Y);
const ALONG: readonly [number, number] = [BAND_ALONG_X / length, BAND_ALONG_Y / length];
const ACROSS: readonly [number, number] = [-ALONG[1], ALONG[0]];

/**
 * A point in the band's own frame on screen: `u` along the band from its
 * middle, `v` across it from its centre line. The shader's mapping run
 * backwards (into the turned sky, unturn, undo the parallax and zoom, then
 * from sky units to pixels, y down).
 */
export function bandToScreen(u: number, v: number, sky: SkyView): [number, number] {
  const { aspect, zoom, turn, driftX, driftY } = skyUniforms(sky);
  // The shader measures across from the line BAND_OFFSET below the centre.
  const across = v - BAND_OFFSET;
  const px = u * ALONG[0] + across * ACROSS[0];
  const py = u * ALONG[1] + across * ACROSS[1];
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const rawX = c * px + s * py;
  const rawY = -s * px + c * py;
  const x = ((rawX - driftX) * zoom) / aspect + 0.5;
  const y = (rawY - driftY) * zoom + 0.5;
  return [x * sky.view.width, (1 - y) * sky.view.height];
}
