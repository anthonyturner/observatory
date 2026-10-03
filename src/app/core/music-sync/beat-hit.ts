import { MotifLayer, MusicInks, MusicScene, reachOf } from './motifs/motif-layer';
import { MusicFrame } from './music-sync.types';

interface Ring {
  radius: number;
  life: number;
}

/** A flash of light round the core, from just outside it out to here, in core radii. */
const PUNCH_FROM = 1.2;
const PUNCH_TO = 3.6;
const PUNCH_ALPHA = 0.9;
/** A bright ring thrown fast from the core on each beat. */
const RING_FROM = 1.2;
const RING_SPEED_PX = 1500;
const RING_LIFE_S = 0.55;
const RING_WIDTH_PX = 16;
const RING_ALPHA = 0.9;
/** The screen's edges glow from this share of the way out from the core. */
const EDGE_FROM = 0.45;
const EDGE_ALPHA = 0.4;
/** How much bigger the sky is drawn at the height of a beat. */
const ZOOM = 0.06;

/** What lands on every beat whatever the motif: a punch of light round the
 *  core, a ring thrown out from it, a glow at the screen's edges and a short
 *  zoom, all riding the beat's pulse so the sky hits with the kick. */
export class BeatHit implements MotifLayer {
  private rings: Ring[] = [];
  private pulse = 0;

  step(frame: MusicFrame, stepS: number, scene: MusicScene): void {
    this.pulse = frame.pulse;
    if (frame.beat) this.rings.push({ radius: scene.coreRadius * RING_FROM, life: 1 });
    this.rings = this.rings
      .map((ring) => ({
        radius: ring.radius + RING_SPEED_PX * stepS,
        life: ring.life - stepS / RING_LIFE_S,
      }))
      .filter((ring) => ring.life > 0);
  }

  /** How much bigger to draw the sky now. */
  zoom(): number {
    return 1 + ZOOM * this.pulse;
  }

  draw(context: CanvasRenderingContext2D, scene: MusicScene, inks: MusicInks): void {
    this.drawPunch(context, scene, inks);
    this.drawRings(context, scene, inks);
    this.drawEdges(context, scene, inks);
  }

  private drawPunch(context: CanvasRenderingContext2D, scene: MusicScene, inks: MusicInks): void {
    const { originX: x, originY: y, coreRadius: r } = scene;
    const punch = context.createRadialGradient(x, y, r * PUNCH_FROM, x, y, r * PUNCH_TO);
    punch.addColorStop(0, inks.accent);
    punch.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalAlpha = PUNCH_ALPHA * this.pulse;
    context.fillStyle = punch;
    context.fillRect(x - r * PUNCH_TO, y - r * PUNCH_TO, r * PUNCH_TO * 2, r * PUNCH_TO * 2);
  }

  private drawRings(context: CanvasRenderingContext2D, scene: MusicScene, inks: MusicInks): void {
    const reach = reachOf(scene);
    context.strokeStyle = inks.accent;
    for (const ring of this.rings) {
      context.globalAlpha = RING_ALPHA * ring.life;
      context.lineWidth = RING_WIDTH_PX * ring.life;
      context.beginPath();
      context.arc(scene.originX, scene.originY, Math.min(ring.radius, reach), 0, Math.PI * 2);
      context.stroke();
    }
  }

  private drawEdges(context: CanvasRenderingContext2D, scene: MusicScene, inks: MusicInks): void {
    const reach = reachOf(scene);
    const { originX: x, originY: y } = scene;
    const edges = context.createRadialGradient(x, y, reach * EDGE_FROM, x, y, reach);
    edges.addColorStop(0, 'rgba(0,0,0,0)');
    edges.addColorStop(1, inks.primary);
    context.globalAlpha = EDGE_ALPHA * this.pulse;
    context.fillStyle = edges;
    context.fillRect(0, 0, scene.width, scene.height);
  }
}

/** Where the beat's zoom scales the sky from: the core, held inside the screen.
 *  Scaled about a core scrolled off the screen, the sky would slide away from
 *  it on every beat and bare the edge it left; from a point on the screen, a
 *  zoom of 1 or more always covers it. */
export function zoomAnchor(scene: MusicScene): { readonly x: number; readonly y: number } {
  return {
    x: Math.min(Math.max(scene.originX, 0), scene.width),
    y: Math.min(Math.max(scene.originY, 0), scene.height),
  };
}
