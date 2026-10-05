import { SkyFrame } from './sky-frame';

/* Where the review queue's spiral galaxy is, in one place: its shader draws it
   from these numbers, and the Spiral of Done places finished work on its arms
   with the same ones, so a light always sits on the arm the shader drew. */

/** The galaxy's centre, in sky units: across as a share of the aspect, then up. */
export const GALAXY_CENTRE_X = 0.3;
export const GALAXY_CENTRE_Y = 0.17;
/** How far the disc is turned on screen, in radians. */
export const GALAXY_TURN = 0.55;
/** How tilted away it is: its minor axis over its major one. */
export const GALAXY_TILT = 0.42;
/** How tightly the arms wind: radians of turn per e-fold of radius. */
export const GALAXY_WIND = 2.6;
/** The arms turn this many radians a second: barely, but they turn. */
export const GALAXY_SPIN = 0.004;
/** How much the galaxy shifts and grows with the camera: far, so very little. */
export const GALAXY_PARALLAX = 0.00003;
export const GALAXY_ZOOM_POWER = 0.1;

/** What the galaxy's place on screen depends on this frame. */
export interface GalaxyView {
  readonly width: number;
  readonly height: number;
  /** The camera's centre and scale. */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  /** Scene seconds, held at 0 when the sky is still. */
  readonly t: number;
}

/** This frame's view, as the galaxy reads it: the sky's clock holds when it is still. */
export const galaxyView = (f: SkyFrame): GalaxyView => ({
  width: f.width,
  height: f.height,
  x: f.camera.current.x,
  y: f.camera.current.y,
  scale: f.camera.current.scale,
  t: f.frozen ? 0 : f.t,
});

/** The uniforms the shader takes, worked out once for both it and the lights. */
export function galaxyUniforms(view: GalaxyView) {
  return {
    aspect: view.width / Math.max(1, view.height),
    zoom: Math.pow(view.scale, GALAXY_ZOOM_POWER),
    spin: view.t * GALAXY_SPIN,
    driftX: view.x * GALAXY_PARALLAX,
    driftY: -view.y * GALAXY_PARALLAX,
  };
}

/** The angle of arm `arm` (0 or 1) at radius `r`, as the shader winds it. */
export const armAngle = (r: number, arm: number, spin: number): number =>
  GALAXY_WIND * Math.log(r) + spin + arm * Math.PI;

/**
 * A point in the galaxy's own plane, at radius `r` and angle `theta`, on
 * screen: the shader's mapping run backwards (untilt, unturn, recentre, undo
 * the parallax and zoom, then from sky units to pixels, y down).
 */
export function galaxyToScreen(r: number, theta: number, view: GalaxyView): [number, number] {
  const { aspect, zoom, driftX, driftY } = galaxyUniforms(view);
  const qx = Math.cos(theta) * r;
  const qy = Math.sin(theta) * r * GALAXY_TILT;
  const c = Math.cos(GALAXY_TURN);
  const s = Math.sin(GALAXY_TURN);
  const px = c * qx + s * qy + GALAXY_CENTRE_X * aspect;
  const py = -s * qx + c * qy + GALAXY_CENTRE_Y;
  const u = ((px - driftX) * zoom) / aspect + 0.5;
  const v = (py - driftY) * zoom + 0.5;
  return [u * view.width, (1 - v) * view.height];
}
