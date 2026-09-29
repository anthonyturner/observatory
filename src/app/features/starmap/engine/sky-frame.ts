import { CameraController } from './camera-controller';
import { FieldStar, SkyCluster, SkyStar } from './sky-model';

/** Which sky is on screen. */
export type Chart = 'prs' | 'logs' | 'issues';

/** Everything a renderer needs to draw one frame, read from the engine. */
export interface SkyFrame {
  /** The 2D canvas: the whole sky in 2D, the overlay over the 3D sky. */
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly camera: CameraController;
  /** Scene time, frozen at a still moment when motion is off. */
  readonly t: number;
  /** Wall time in seconds, for arrivals. */
  readonly wall: number;
  readonly frozen: boolean;
  readonly chart: Chart;
  readonly stars: readonly SkyStar[];
  readonly clusters: readonly SkyCluster[];
  readonly field: readonly FieldStar[];
  readonly selected: SkyStar | null;
  /** 0 clear to 1 full: how old the data behind the sky is. */
  readonly fog: number;
  readonly layers: readonly SkyLayer[];
  /** Which renderer is drawing: the 2D sky draws bursts itself, the 3D one builds them. */
  readonly renderer: 'canvas' | 'webgl';
  born(star: SkyStar): number;
  passes(star: SkyStar): boolean;
  dim(star: SkyStar): number;
  dimCluster(cluster: SkyCluster): number;
  toScreen(x: number, y: number, z?: number): [number, number];
}

/**
 * A burst the 3D scene builds and plays: how it looks, how far through it is,
 * and where. `key` stays the same from frame to frame while it plays.
 */
export interface NewsEffect3D {
  readonly key: object;
  readonly mode: 'nova' | 'supernova' | 'implode' | 'shooting';
  /** 0 to 1 through the burst. */
  readonly p: number;
  readonly star: SkyStar | null;
  readonly colour: string;
  /** Seeds the debris, so a burst looks the same each time it plays. */
  readonly seed: number;
  /** Where a crossing starts, in the world, and its heading. */
  readonly from: { readonly x: number; readonly y: number; readonly z: number };
  readonly angle: number;
  /** Told where a crossing's head is on screen, for its label. */
  readonly onHead?: (head: [number, number]) => void;
}

/** A traced fault and the other windows where the same fault fires. */
export interface LogThreads {
  readonly traced: SkyStar;
  readonly twins: readonly SkyStar[];
}

/**
 * Something a sky draws besides its stars: comets, collision threads, the
 * merge plan, the changes. Each hook runs at the point pr-starmap drew it.
 */
export interface SkyLayer {
  /** Each frame before the stars drift, to move stars a sky turns itself. */
  move?(t: number, frozen: boolean): void;
  /** Into the glow layer, before the constellations. */
  beneath?(c: CanvasRenderingContext2D, frame: SkyFrame): void;
  /** Into the glow layer, after the stars. */
  above?(c: CanvasRenderingContext2D, frame: SkyFrame): void;
  /** Into the flat layer both renderers share, before the constellations' words:
   *  after the glow is composited in 2D, over the 3D scene in 3D. */
  flat?(ctx: CanvasRenderingContext2D, frame: SkyFrame): void;
  /** Words, after the glow is composited. */
  labels?(ctx: CanvasRenderingContext2D, frame: SkyFrame): void;
  /** Something of its own under a click that hit no star, as a comet. */
  pick?(sx: number, sy: number): unknown;
  /** Bursts for the 3D scene to play, where the 2D sky would draw them itself. */
  effects3D?(frame: SkyFrame): NewsEffect3D[];
  /** Log threads for the 3D scene to draw in depth, where the 2D sky draws them flat. */
  threads3D?(frame: SkyFrame): LogThreads | null;
}

/** A renderer: pr-starmap's contract of mount, setScene, frame, pick, toScreen, resize, dispose. */
export interface SkyRenderer {
  readonly kind: 'canvas' | 'webgl';
  mount(): void;
  setScene(scene: SkyScene): void;
  frame(frame: SkyFrame): void;
  toScreen(x: number, y: number, z?: number): [number, number];
  resize(): void;
  dispose(): void;
}

/** What a renderer builds its scene from. */
export interface SkyScene {
  readonly stars: readonly SkyStar[];
  readonly clusters: readonly SkyCluster[];
  readonly field: readonly FieldStar[];
}
