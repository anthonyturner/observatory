import { Bead } from '../beads';
import { CoreLook } from '../core-look';
import { Lens } from '../lens';
import { CorePalette, rgbCss } from '../palette';

/** A bead as it draws this frame: how far it has grown in, 0 to 1. */
export interface GrowingBead {
  readonly bead: Bead;
  readonly grown: number;
}

export interface GlowScene {
  readonly look: CoreLook;
  readonly radius: number;
  readonly breath: number;
  readonly intro: number;
  readonly beads: readonly GrowingBead[];
  readonly width: number;
  readonly height: number;
}

/** The bloom layer runs at half resolution: it is about to be blurred. */
const GLOW_SCALE = 0.5;
const HEART_GLOW_REACH = 0.75;
const BEAD_GLOW_REACH = 2.6;
const BEAD_GLOW_ALPHA = 0.55;
const BEAD_CORE = 0.75;
const BEAD_RING = 1.9;
const RING_ALPHA = 0.85;
const HEART_SIZE = 0.03;
/** Two blurs, a tight one and a wide one, read as light rather than as a smudge. */
const BLURS = [
  { filter: 'blur(6px)', alpha: 0.9 },
  { filter: 'blur(22px)', alpha: 0.4 },
] as const;

/** The ball's heart and the beads: a blurred glow under each, then a crisp mark over it. */
export class GlowPainter {
  private readonly layer = document.createElement('canvas');

  resize(width: number, height: number): void {
    this.layer.width = Math.max(2, Math.floor(width * GLOW_SCALE));
    this.layer.height = Math.max(2, Math.floor(height * GLOW_SCALE));
  }

  paint(
    context: CanvasRenderingContext2D,
    lens: Lens,
    palette: CorePalette,
    scene: GlowScene,
  ): void {
    this.paintLayer(lens, palette, scene);
    context.save();
    context.globalCompositeOperation = 'lighter';
    for (const { filter, alpha } of BLURS) {
      context.filter = filter;
      context.globalAlpha = alpha;
      context.drawImage(this.layer, 0, 0, scene.width, scene.height);
    }
    context.filter = 'none';
    context.globalAlpha = 1;
    context.drawImage(this.layer, 0, 0, scene.width, scene.height);
    this.paintCrisp(context, lens, palette, scene);
    context.restore();
  }

  private paintLayer(lens: Lens, palette: CorePalette, scene: GlowScene): void {
    const glow = this.layer.getContext('2d');
    if (!glow) return;
    glow.setTransform(1, 0, 0, 1, 0, 0);
    glow.clearRect(0, 0, this.layer.width, this.layer.height);
    glow.save();
    glow.scale(GLOW_SCALE, GLOW_SCALE);
    glow.globalCompositeOperation = 'lighter';
    const { look, radius, breath, intro } = scene;
    const heart = lens.project(0, 0, 0);
    const reach = radius * HEART_GLOW_REACH * breath;
    glow.globalAlpha = Math.min(1, 0.5 * look.level) * intro;
    glow.fillStyle = radialFill(glow, { x: heart.x, y: heart.y, reach }, [
      rgbCss(look.tint),
      rgbCss(look.tint, 0.35),
    ]);
    glow.fillRect(heart.x - radius, heart.y - radius, radius * 2, radius * 2);
    for (const { bead, grown } of scene.beads) {
      const seen = lens.project(bead.x, bead.y, bead.z);
      const beadReach = bead.size * seen.scale * grown * BEAD_GLOW_REACH;
      glow.globalAlpha = BEAD_GLOW_ALPHA * bead.dim;
      glow.fillStyle = radialFill(glow, { x: seen.x, y: seen.y, reach: beadReach }, [
        palette.colour(bead.severity.color),
      ]);
      glow.fillRect(seen.x - beadReach, seen.y - beadReach, beadReach * 2, beadReach * 2);
    }
    glow.restore();
  }

  private paintCrisp(
    context: CanvasRenderingContext2D,
    lens: Lens,
    palette: CorePalette,
    scene: GlowScene,
  ): void {
    const heart = lens.project(0, 0, 0);
    context.globalAlpha = scene.intro;
    context.fillStyle = palette.heart;
    fillCircle(context, heart.x, heart.y, scene.radius * HEART_SIZE * scene.breath + 1);
    for (const { bead, grown } of scene.beads) {
      const seen = lens.project(bead.x, bead.y, bead.z);
      const size = bead.size * seen.scale * grown;
      const colour = palette.colour(bead.severity.color);
      context.globalAlpha = bead.dim;
      context.fillStyle = colour;
      fillCircle(context, seen.x, seen.y, size * BEAD_CORE);
      if (!bead.isRinged) continue;
      context.globalAlpha = RING_ALPHA * bead.dim;
      context.strokeStyle = colour;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(seen.x, seen.y, size * BEAD_RING, 0, Math.PI * 2);
      context.stroke();
    }
  }
}

interface Glow {
  readonly x: number;
  readonly y: number;
  readonly reach: number;
}

/** A glow from the first colour at the centre, through any others, to nothing at `reach`. */
function radialFill(
  context: CanvasRenderingContext2D,
  { x, y, reach }: Glow,
  colours: readonly string[],
): CanvasGradient {
  const gradient = context.createRadialGradient(x, y, 0, x, y, Math.max(reach, 0.01));
  const [first, ...rest] = colours;
  gradient.addColorStop(0, first);
  rest.forEach((colour, i) => gradient.addColorStop((0.3 * (i + 1)) / rest.length, colour));
  gradient.addColorStop(1, 'transparent');
  return gradient;
}

function fillCircle(context: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  context.beginPath();
  context.arc(x, y, Math.max(radius, 0), 0, Math.PI * 2);
  context.fill();
}
