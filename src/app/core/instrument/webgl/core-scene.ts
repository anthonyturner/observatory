import { Group } from 'three';
import { ProjectSnapshot } from '../../projects/project.types';
import { ballCount3D, ballNetwork } from '../ball-network';
import { layoutBeads } from '../beads';
import { CorePose, ballRadiusOf } from '../core-animator';
import { CoreFrame } from '../core-renderer';
import { CoreView } from '../core-view';
import { buildFloorGrid, floorKey } from '../floor-grid';
import { CorePalette } from '../palette';
import { orbitLoop } from '../rings';
import { BallObject } from './ball-object';
import { BeadPoints } from './bead-points';
import { CentreGlow, overflowMark } from './centre-glow';
import { GpuResources } from './gpu-resources';
import { InstrumentLines } from './instrument-lines';

export interface SceneSource {
  readonly view: CoreView;
  readonly projects: readonly ProjectSnapshot[];
  readonly palette: CorePalette;
}

export interface SceneFrame {
  readonly pose: CorePose;
  readonly view: CoreView;
  readonly pixelRatio: number;
  readonly frame: CoreFrame;
}

/** Dots keep their size near a desktop core's and shrink a little on a phone's. */
const DOT_SCALE_RADIUS = 140;
const MIN_DOT_SCALE = 0.7;
const MAX_DOT_SCALE = 1.1;

/** The instrument as GPU objects: about a dozen draw calls, a few thousand
 *  vertices, and nothing allocated per frame but the tier arcs. The model is
 *  in screen pixels about the core's centre with y down, so the group flips y. */
export class CoreScene {
  readonly group = new Group();
  private readonly resources = new GpuResources();
  private readonly lines: InstrumentLines;
  private readonly ball: BallObject;
  private readonly beads: BeadPoints;
  private readonly glow: CentreGlow;
  private readonly coreRadius: number;

  /** What the scene is built from: a view with the same key needs no rebuild. */
  static shapeKey(view: CoreView): string {
    return floorKey({ coreRadius: view.radius, windowWidth: view.width, depth: view.floorDepth });
  }

  constructor({ view, projects, palette }: SceneSource) {
    this.coreRadius = view.radius;
    this.group.scale.y = -1;
    const layout = layoutBeads(projects, view.radius);
    this.lines = new InstrumentLines(
      {
        floor: buildFloorGrid({
          coreRadius: view.radius,
          windowWidth: view.width,
          depth: view.floorDepth,
        }),
        orbit: orbitLoop(view.radius),
        coreRadius: view.radius,
        floorInk: palette.floor,
        ringInk: palette.ring,
      },
      this.resources,
    );
    this.ball = new BallObject(ballNetwork(ballCount3D(view.radius)), this.resources);
    this.beads = new BeadPoints(
      layout.beads,
      (bead) => palette.colour(bead.severity.color),
      palette.stale,
      this.resources,
    );
    this.glow = new CentreGlow(this.resources);
    this.group.add(
      this.lines.group,
      this.ball.group,
      this.beads.points,
      this.glow.halo,
      this.glow.heart,
    );
    if (layout.overflow) {
      const mark = overflowMark(
        layout.overflow,
        { ink: palette.mark, font: palette.markFont },
        this.resources,
      );
      this.group.add(mark);
    }
  }

  update({ pose, view, pixelRatio, frame }: SceneFrame): void {
    this.group.visible = !view.isAway;
    if (view.isAway) return;
    this.group.position.set(view.centreX, -view.centreY, 0);
    this.lines.update(pose, view.lift);
    this.ball.update({
      pose,
      radius: ballRadiusOf(pose, this.coreRadius),
      pixelRatio,
      dotScale: Math.min(
        MAX_DOT_SCALE,
        Math.max(MIN_DOT_SCALE, this.coreRadius / DOT_SCALE_RADIUS),
      ),
      hand: frame.hand,
      viewWidth: view.width,
      viewHeight: view.height,
      isStill: frame.isStill,
    });
    this.beads.update(pose, pixelRatio, frame);
    this.glow.update(pose, this.ball.tint, this.coreRadius);
  }

  dispose(): void {
    this.resources.disposeAll();
  }
}
