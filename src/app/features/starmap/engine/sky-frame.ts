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
  born(star: SkyStar): number;
  passes(star: SkyStar): boolean;
  dim(star: SkyStar): number;
  dimCluster(cluster: SkyCluster): number;
  toScreen(x: number, y: number, z?: number): [number, number];
}

/**
 * Something a sky draws besides its stars: comets, collision threads, the
 * merge plan, the changes. Each hook runs at the point pr-starmap drew it.
 */
export interface SkyLayer {
  /** Into the glow layer, before the constellations. */
  beneath?(c: CanvasRenderingContext2D, frame: SkyFrame): void;
  /** Into the glow layer, after the stars. */
  above?(c: CanvasRenderingContext2D, frame: SkyFrame): void;
  /** Words, after the glow is composited. */
  labels?(ctx: CanvasRenderingContext2D, frame: SkyFrame): void;
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
