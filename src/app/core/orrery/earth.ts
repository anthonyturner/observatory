import { OrreryCamera, Viewport } from './orrery-camera';

/** The Earth at the orbit origin, in orrery units. */
export const EARTH_RADIUS = 60;

/** The Earth's disc on screen, in pixels. It sits at the orbit origin, which both the 2D and the 3D camera put at the same place. */
export const earthOnScreen = (
  camera: OrreryCamera,
  view: Viewport,
): { readonly x: number; readonly y: number; readonly radius: number } => {
  const [x, y] = camera.toScreen(0, 0, view);
  return { x, y, radius: EARTH_RADIUS * camera.current.scale };
};

/** The longitude that faces the viewer, in degrees east: the Atlantic, with the
 *  Americas on the day side and Europe and Africa's lights on the night side. */
const FACING_LONGITUDE_DEG = -30;

/** How far the 3D Earth's ground is turned about its axis so that longitude
 *  faces the viewer. A sphere's texture starts with longitude -90 facing the
 *  viewer, hence the quarter turn. */
export const EARTH_TURN = ((-90 - FACING_LONGITUDE_DEG) * Math.PI) / 180;

/** Pixels of an equirectangular map: the whole globe, longitude -180 at the left, north at the top. */
export interface MapPixels {
  readonly width: number;
  readonly height: number;
  readonly data: ArrayLike<number>;
}

const CHANNELS = 4;

/**
 * The globe as the viewer sees it, drawn flat as a `size` by `size` disc of
 * RGBA pixels, for the 2D orrery. It faces the same longitude as the 3D Earth,
 * north up, once turned `spin` radians eastward (as `EarthSpin` counts them),
 * which brings the longitudes to its west round to the front. Pixels outside
 * the disc are transparent, and its edge is soft.
 */
export function earthDisc(map: MapPixels, size: number, spin = 0): Uint8ClampedArray {
  const disc = new Uint8ClampedArray(size * size * CHANNELS);
  const facing = (FACING_LONGITUDE_DEG * Math.PI) / 180 - spin;
  for (let row = 0; row < size; row++) {
    const y = 1 - ((row + 0.5) / size) * 2;
    for (let column = 0; column < size; column++) {
      const x = ((column + 0.5) / size) * 2 - 1;
      const outside = x * x + y * y;
      if (outside >= 1) continue;
      const longitude = facing + Math.atan2(x, Math.sqrt(1 - outside));
      const latitude = Math.asin(y);
      const mapColumn = Math.floor(wrap(longitude / (2 * Math.PI) + 0.5) * map.width);
      const mapRow = Math.min(map.height - 1, Math.floor((0.5 - latitude / Math.PI) * map.height));
      const from = (mapRow * map.width + mapColumn) * CHANNELS;
      const to = (row * size + column) * CHANNELS;
      for (let channel = 0; channel < 3; channel++) disc[to + channel] = map.data[from + channel];
      const edge = Math.min(1, (1 - Math.sqrt(outside)) * (size / 2));
      disc[to + 3] = edge * 255;
    }
  }
  return disc;
}

/** The fraction part of `value`, so 1.25 and -0.75 are both 0.25. */
const wrap = (value: number): number => value - Math.floor(value);
