/* The nursery's bodies are stamped from pre-drawn sprites, one per look and
   colour, which keeps a thousand of them cheap. Canvas inks, pr-starmap's own. */

const SPRITE_SIZE = 96;
const GLOBULE_HAZE = [
  'rgba(159, 232, 255, 0.10)',
  'rgba(159, 232, 255, 0.16)',
  'rgba(159, 232, 255, 0)',
];
const GLOBULE_CORE = 'rgba(6, 14, 28, 0.92)';
const GLOBULE_RIM = 'rgba(159, 232, 255, 0.75)';
const STAR_HEART = '#ffffff';

/** A globule is dark gas, lit only at its rim; a star is a glow with a hot core. */
export type SpriteKind = 'globule' | 'star';

function drawGlobule(g: CanvasRenderingContext2D, m: number): void {
  const haze = g.createRadialGradient(m, m, 0, m, m, m);
  haze.addColorStop(0, GLOBULE_HAZE[0]);
  haze.addColorStop(0.55, GLOBULE_HAZE[1]);
  haze.addColorStop(1, GLOBULE_HAZE[2]);
  g.fillStyle = haze;
  g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  g.fillStyle = GLOBULE_CORE;
  g.beginPath();
  g.arc(m, m, m * 0.42, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = GLOBULE_RIM;
  g.lineWidth = 2.2;
  g.beginPath();
  g.arc(m, m, m * 0.42, 0, Math.PI * 2);
  g.stroke();
}

function drawStarBody(g: CanvasRenderingContext2D, m: number, colour: string): void {
  const glow = g.createRadialGradient(m, m, 0, m, m, m);
  glow.addColorStop(0, colour);
  glow.addColorStop(0.28, `${colour}88`);
  glow.addColorStop(1, `${colour}00`);
  g.fillStyle = glow;
  g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  g.fillStyle = colour;
  g.beginPath();
  g.arc(m, m, m * 0.2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = STAR_HEART;
  g.beginPath();
  g.arc(m, m, m * 0.1, 0, Math.PI * 2);
  g.fill();
}

/** Draws each body once and hands the same canvas back after. */
export class NurserySprites {
  private readonly sprites = new Map<string, HTMLCanvasElement>();

  constructor(private readonly document: Document) {}

  get(kind: SpriteKind, colour: string): HTMLCanvasElement {
    const key = `${kind}|${colour}`;
    const cached = this.sprites.get(key);
    if (cached) return cached;
    const canvas = this.document.createElement('canvas');
    canvas.width = canvas.height = SPRITE_SIZE;
    const g = canvas.getContext('2d');
    if (g) {
      if (kind === 'globule') drawGlobule(g, SPRITE_SIZE / 2);
      else drawStarBody(g, SPRITE_SIZE / 2, colour);
    }
    this.sprites.set(key, canvas);
    return canvas;
  }
}
