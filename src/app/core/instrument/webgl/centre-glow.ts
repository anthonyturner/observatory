import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DataTexture,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Texture,
} from 'three';
import { BeadOverflow } from '../beads';
import { CorePose } from '../core-animator';
import { GpuResources } from './gpu-resources';

const SOFT_SIZE = 128;
/** A bright centre falling away fast, then a long faint tail. */
const SOFT_STOPS = [
  { at: 0, alpha: 1 },
  { at: 0.18, alpha: 0.4 },
  { at: 0.45, alpha: 0.07 },
  { at: 1, alpha: 0 },
] as const;
const HALO_OPACITY = 0.6;
const HALO_REACH = 2.4;
const HEART_REACH = 0.3;
const MAX_HALO_LEVEL = 1.6;
const HEART_LEVEL = 1.4;
const WHITE = new Color(1, 1, 1);

const MARK_SIZE = 64;

/** The haze at the ball's centre: a wide soft glow and a small hot heart. */
export class CentreGlow {
  readonly halo: Sprite;
  readonly heart: Sprite;

  constructor(resources: GpuResources) {
    const soft = resources.own(softTexture());
    this.halo = additiveSprite(soft, HALO_OPACITY, resources);
    this.heart = additiveSprite(soft, 1, resources);
  }

  update(pose: CorePose, tint: Color, coreRadius: number): void {
    const size = coreRadius * pose.breath * pose.intro;
    const level = pose.look.level;
    this.halo.material.color.copy(tint).multiplyScalar(Math.min(MAX_HALO_LEVEL, level));
    this.heart.material.color
      .copy(tint)
      .lerp(WHITE, 0.5)
      .multiplyScalar(HEART_LEVEL * level);
    this.halo.scale.setScalar(size * HALO_REACH);
    this.heart.scale.setScalar(size * HEART_REACH);
  }
}

/** "+n" for the projects past the last bead, drawn once into a texture. */
export function overflowMark(
  overflow: BeadOverflow,
  style: { readonly ink: string; readonly font: string },
  resources: GpuResources,
): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = MARK_SIZE;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = style.ink;
    context.font = style.font;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`+${overflow.count}`, MARK_SIZE / 2, MARK_SIZE / 2);
  }
  const texture = resources.own(new CanvasTexture(canvas));
  texture.colorSpace = SRGBColorSpace;
  const mark = new Sprite(resources.own(new SpriteMaterial({ map: texture, transparent: true })));
  mark.position.set(overflow.x, overflow.y, overflow.z);
  mark.scale.set(MARK_SIZE, -MARK_SIZE, 1);
  return mark;
}

function additiveSprite(map: Texture, opacity: number, resources: GpuResources): Sprite {
  const material = new SpriteMaterial({
    map,
    opacity,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  return new Sprite(resources.own(material));
}

/** White with alpha falling off from the centre, built as data rather than painted. */
function softTexture(): DataTexture {
  const data = new Uint8Array(SOFT_SIZE * SOFT_SIZE * 4);
  for (let y = 0; y < SOFT_SIZE; y++) {
    for (let x = 0; x < SOFT_SIZE; x++) {
      const r = Math.hypot(x + 0.5 - SOFT_SIZE / 2, y + 0.5 - SOFT_SIZE / 2) / (SOFT_SIZE / 2);
      const i = (y * SOFT_SIZE + x) * 4;
      data.fill(255, i, i + 3);
      data[i + 3] = Math.round(softAlpha(r) * 255);
    }
  }
  const texture = new DataTexture(data, SOFT_SIZE, SOFT_SIZE);
  texture.needsUpdate = true;
  return texture;
}

function softAlpha(r: number): number {
  if (r >= 1) return 0;
  const next = SOFT_STOPS.findIndex((stop) => stop.at >= r);
  const to = SOFT_STOPS[Math.max(next, 1)];
  const from = SOFT_STOPS[Math.max(next, 1) - 1];
  return from.alpha + ((r - from.at) / (to.at - from.at)) * (to.alpha - from.alpha);
}
