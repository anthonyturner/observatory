import { BallNetwork, ballNetwork } from '../ball-network';
import { CoreLook, rippleAt } from '../core-look';
import { HAND_BRIGHT, HAND_GROW, HAND_PUSH, HAND_REACH, HandPose, nearness } from '../hand';
import { Lens } from '../lens';
import { rgbCss } from '../palette';

export interface BallPose {
  readonly look: CoreLook;
  readonly radius: number;
  /** How bright the ball draws, the look's level faded in on load. */
  readonly level: number;
  readonly pointCount: number;
  /** The ball's turn: the idle spin plus the hand's. */
  readonly yaw: number;
  readonly pitch: number;
  readonly hand: HandPose;
  /** With motion off, points glow under the hand but are not pushed. */
  readonly isStill: boolean;
}

/** Lines go in three batches by depth, back to front, since a canvas path carries one alpha. */
const DEPTH_BANDS = 3;
const LINE_ALPHA_BACK = 0.1;
const LINE_ALPHA_STEP = 0.08;
const POINT_SIZE = 1.1;
const POINT_SIZE_SPREAD = 1.8;

/** The ball in 2D: its points and lines turned and projected every frame. */
export class BallPainter {
  private network: BallNetwork | null = null;
  private screenX: Float32Array = new Float32Array(0);
  private screenY: Float32Array = new Float32Array(0);
  /** 0 at the back of the ball, 1 at the front. */
  private depth: Float32Array = new Float32Array(0);
  /** 0 to 1: how lit each point is by the hand. */
  private touched: Float32Array = new Float32Array(0);

  paint(context: CanvasRenderingContext2D, lens: Lens, pose: BallPose): void {
    const network = this.networkOf(pose.pointCount);
    this.project(network, lens, pose);
    const ink = rgbCss(pose.look.tint);
    context.strokeStyle = ink;
    for (let band = 0; band < DEPTH_BANDS; band++)
      this.strokeBand(context, network, band, pose.level);
    context.fillStyle = ink;
    this.fillPoints(context, network, pose);
  }

  private networkOf(count: number): BallNetwork {
    if (this.network?.count !== count) {
      this.network = ballNetwork(count);
      this.screenX = new Float32Array(this.network.count);
      this.screenY = new Float32Array(this.network.count);
      this.depth = new Float32Array(this.network.count);
      this.touched = new Float32Array(this.network.count);
    }
    return this.network;
  }

  /** Tipped first, then turned: the order the 3D core uses. Then each point
   *  near the hand lights and is pushed a little away from it, on the screen. */
  private project(network: BallNetwork, lens: Lens, pose: BallPose): void {
    const { radius, hand } = pose;
    const cosYaw = Math.cos(pose.yaw);
    const sinYaw = Math.sin(pose.yaw);
    const cosPitch = Math.cos(pose.pitch);
    const sinPitch = Math.sin(pose.pitch);
    const reach = radius * HAND_REACH;
    const push = pose.isStill ? 0 : radius * HAND_PUSH;
    const { points } = network;
    for (let i = 0; i < network.count; i++) {
      const x = points[i * 3];
      const y = points[i * 3 + 1] * cosPitch + points[i * 3 + 2] * sinPitch;
      const z = -points[i * 3 + 1] * sinPitch + points[i * 3 + 2] * cosPitch;
      const turnedZ = -x * sinYaw + z * cosYaw;
      const seen = lens.project((x * cosYaw + z * sinYaw) * radius, y * radius, turnedZ * radius);
      const awayX = seen.x - hand.x;
      const awayY = seen.y - hand.y;
      const distance = Math.hypot(awayX, awayY);
      const lit = hand.glow > 0 ? hand.glow * nearness(distance, reach) : 0;
      const shove = distance > 0.001 ? (lit * push) / distance : 0;
      this.screenX[i] = seen.x + awayX * shove;
      this.screenY[i] = seen.y + awayY * shove;
      this.depth[i] = turnedZ * 0.5 + 0.5;
      this.touched[i] = lit;
    }
  }

  private strokeBand(
    context: CanvasRenderingContext2D,
    network: BallNetwork,
    band: number,
    level: number,
  ): void {
    const { links } = network;
    context.globalAlpha = Math.min(1, level * (LINE_ALPHA_BACK + band * LINE_ALPHA_STEP));
    context.beginPath();
    for (let i = 0; i < links.length; i += 3) {
      const a = links[i];
      const b = links[i + 1];
      const depth = (this.depth[a] + this.depth[b]) / 2;
      if (Math.min(DEPTH_BANDS - 1, Math.floor(depth * DEPTH_BANDS)) !== band) continue;
      context.moveTo(this.screenX[a], this.screenY[a]);
      context.lineTo(this.screenX[b], this.screenY[b]);
    }
    context.stroke();
  }

  private fillPoints(
    context: CanvasRenderingContext2D,
    network: BallNetwork,
    pose: BallPose,
  ): void {
    const { points, weights } = network;
    for (let i = 0; i < network.count; i++) {
      const distance = Math.hypot(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
      const wave = rippleAt(distance, pose.look.time, pose.look.ripple);
      const weight = weights[i];
      const lit = this.touched[i];
      const size =
        (POINT_SIZE + weight * POINT_SIZE_SPREAD) * (1 + wave * 0.5) * (1 + lit * HAND_GROW);
      context.globalAlpha = Math.min(
        1,
        pose.level *
          (0.35 + weight * 0.65) *
          (0.35 + 0.65 * this.depth[i]) *
          (1 + wave * 2.5) *
          (1 + lit * HAND_BRIGHT),
      );
      context.fillRect(this.screenX[i] - size / 2, this.screenY[i] - size / 2, size, size);
    }
  }
}
