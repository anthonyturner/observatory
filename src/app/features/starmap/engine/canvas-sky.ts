import { FLOW_INK, LINK_GAP, LINK_INK, trimSegment } from './link-ink';
import { rnd } from './rnd';
import { SkyFrame, SkyRenderer } from './sky-frame';
import { QUICK_COLOUR, SkyCluster, SkyStar } from './sky-model';

/* pr-starmap's Canvas 2D sky, function for function. It is the whole sky when
   WebGL is unavailable, and its words and marks are the overlay over the 3D one. */

const GRID_STEP = 300;
const GRAIN_TILE = 128;
const NEBULA_INKS = ['#3b2a8f', '#12507a', '#57208f', '#0f6a72', '#2a1d7a', '#7a2b63'];

/** One tile of monochrome noise, reused every frame at a shifting offset. */
export function buildGrain(document: Document): HTMLCanvasElement {
  const grain = document.createElement('canvas');
  grain.width = grain.height = GRAIN_TILE;
  const g = grain.getContext('2d');
  if (!g) return grain;
  const img = g.createImageData(GRAIN_TILE, GRAIN_TILE);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.random() * 140;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return grain;
}

function buildNebula(document: Document): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1280;
  c.height = 860;
  const n = c.getContext('2d');
  if (!n) return c;
  const nr = rnd(31337);
  for (let i = 0; i < 26; i++) {
    const x = nr() * c.width;
    const y = nr() * c.height;
    const r = 90 + nr() * 300;
    const g = n.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, NEBULA_INKS[i % NEBULA_INKS.length]);
    g.addColorStop(0.55, NEBULA_INKS[(i + 2) % NEBULA_INKS.length] + '55');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    n.globalAlpha = 0.14 + nr() * 0.2;
    n.fillStyle = g;
    n.beginPath();
    n.arc(x, y, r, 0, Math.PI * 2);
    n.fill();
  }
  return c;
}

const toWorld = (f: SkyFrame, sx: number, sy: number): [number, number] => {
  const cam = f.camera.current;
  return [(sx - f.width / 2) / cam.scale + cam.x, (sy - f.height / 2) / cam.scale + cam.y];
};

/** A star chart has a coordinate grid; it also shows how far you are zoomed. */
export function drawGrid(f: SkyFrame): void {
  const { ctx } = f;
  const cam = f.camera.current;
  ctx.save();
  ctx.globalAlpha = Math.min(0.45, cam.scale * 0.33);
  ctx.strokeStyle = 'rgba(120, 150, 220, .16)';
  ctx.lineWidth = 1;
  const [x0, y0] = toWorld(f, 0, 0);
  const [x1, y1] = toWorld(f, f.width, f.height);
  ctx.beginPath();
  for (let x = Math.floor(x0 / GRID_STEP) * GRID_STEP; x < x1; x += GRID_STEP) {
    const [sx] = f.toScreen(x, 0);
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, f.height);
  }
  for (let y = Math.floor(y0 / GRID_STEP) * GRID_STEP; y < y1; y += GRID_STEP) {
    const [, sy] = f.toScreen(0, y);
    ctx.moveTo(0, sy);
    ctx.lineTo(f.width, sy);
  }
  ctx.stroke();
  ctx.restore();
}

/** The queue's order as a dotted silver chain flowing from one constellation to the next. */
function drawFlow(f: SkyFrame, c: CanvasRenderingContext2D): void {
  const { clusters } = f;
  if (clusters.length < 2) return;
  c.save();
  c.setLineDash([0.5, 8]);
  c.lineDashOffset = -f.t * 30;
  c.lineCap = 'round';
  c.lineWidth = 2.2;
  c.strokeStyle = FLOW_INK;
  c.globalAlpha = 0.55;
  c.beginPath();
  clusters.forEach((cl, i) => {
    const last = cl.stars[cl.stars.length - 1];
    const first = cl.stars[0];
    if (!last || !first) return;
    const [ex, ey] = f.toScreen(last.ax, last.ay, last.az);
    if (i === 0) {
      const [fx, fy] = f.toScreen(first.ax, first.ay, first.az);
      c.moveTo(fx, fy);
    }
    c.lineTo(ex, ey);
    const next = clusters[i + 1];
    if (next?.stars[0]) {
      const [nx, ny] = f.toScreen(next.stars[0].ax, next.stars[0].ay, next.stars[0].az);
      c.lineTo(nx, ny);
    }
  });
  c.stroke();
  c.restore();
}

/** A constellation in atlas ink, each segment stopping short of its stars. */
function drawCluster(f: SkyFrame, cluster: SkyCluster, c: CanvasRenderingContext2D): void {
  if (cluster.stars.length < 2 || cluster.arm) return;
  c.save();
  const breath = 0.5 + Math.sin(f.t * 0.62 + cluster.cx * 0.004) * 0.12;
  c.globalAlpha = breath * f.dimCluster(cluster);
  c.strokeStyle = LINK_INK;
  c.lineWidth = 1;
  c.beginPath();
  const onScreen = cluster.stars.map((s) => {
    const [x, y] = f.toScreen(s.ax, s.ay, s.az);
    return { x, y, z: 0, gap: starRadius(f, s, f.born(s)) + LINK_GAP };
  });
  for (let i = 1; i < onScreen.length; i++) {
    const a = onScreen[i - 1];
    const b = onScreen[i];
    const segment = trimSegment(a, b, a.gap, b.gap);
    if (!segment) continue;
    c.moveTo(segment[0].x, segment[0].y);
    c.lineTo(segment[1].x, segment[1].y);
  }
  c.stroke();
  c.restore();
}

/** The dashed, turning ring with reticle ticks round the selected star. */
export function drawReticle(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  t: number,
): void {
  c.save();
  c.globalAlpha = 0.95;
  c.strokeStyle = '#ffffff';
  c.lineWidth = 1.4;
  c.setLineDash([4, 5]);
  c.lineDashOffset = -t * 22;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.stroke();
  // Reticle ticks: a chart marking a target, not a button highlight.
  c.setLineDash([]);
  c.globalAlpha = 0.7;
  c.beginPath();
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    c.moveTo(x + dx * (radius + 3), y + dy * (radius + 3));
    c.lineTo(x + dx * (radius + 9), y + dy * (radius + 9));
  }
  c.stroke();
  c.restore();
}

/** A star its own sky draws gets the ring over its body, in the flat layer. */
function drawCustomReticle(f: SkyFrame): void {
  const star = f.selected;
  if (!star?.custom) return;
  const [x, y] = f.toScreen(star.ax, star.ay, star.az);
  drawReticle(f.ctx, x, y, starRadius(f, star, 1) * 1.5 + 9, f.t);
}

/** The radius a star is drawn at this frame. */
export const starRadius = (f: SkyFrame, star: SkyStar, grow: number): number =>
  star.mag * Math.max(f.camera.current.scale, 0.42) * grow;

function drawStar(f: SkyFrame, star: SkyStar, c: CanvasRenderingContext2D): void {
  if (star.custom) return;
  const grow = f.born(star);
  if (grow <= 0) return;
  const [sx, sy] = f.toScreen(star.ax, star.ay, star.az);
  if (sx < -90 || sy < -90 || sx > f.width + 90 || sy > f.height + 90) return;

  const { t } = f;
  const r = starRadius(f, star, grow);
  const a = f.dim(star) * grow;
  // Two waves of different periods, so the twinkle never settles into a beat.
  const pulse =
    0.78 +
    Math.sin(t * star.twinkleRate + star.twinkle) * 0.16 +
    Math.sin(t * star.twinkleRate * 2.7 + star.twinkle * 1.7) * 0.07;

  c.save();

  // A blocked star sends out a slow ring: the one piece of motion that means something.
  if (star.urgent && !f.frozen) {
    const phase = (t * 0.42 + star.spin) % 1;
    c.globalAlpha = a * (1 - phase) * 0.34;
    c.strokeStyle = star.colour;
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(sx, sy, r * (1.4 + phase * 4.2), 0, Math.PI * 2);
    c.stroke();
  }

  if (star.cost) drawMass(f, star, sx, sy, r, a, c);

  // Restraint: a soft halo and faint spikes, so a full queue reads calm, not glaring.
  const glowR = r * 2.6 * pulse;
  const g = c.createRadialGradient(sx, sy, 0, sx, sy, glowR);
  g.addColorStop(0, star.colour);
  g.addColorStop(0.3, star.colour + '80');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = 0.3 * a * pulse;
  c.fillStyle = g;
  c.beginPath();
  c.arc(sx, sy, glowR, 0, Math.PI * 2);
  c.fill();

  // Diffraction spikes: what a bright point looks like through a lens.
  const spike = r * (1.4 + pulse * 1.0);
  c.globalAlpha = a * 0.28 * pulse;
  c.lineWidth = Math.max(r * 0.11, 0.55);
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
  ]) {
    const lg = c.createLinearGradient(
      sx - dx * spike,
      sy - dy * spike,
      sx + dx * spike,
      sy + dy * spike,
    );
    lg.addColorStop(0, 'rgba(0,0,0,0)');
    lg.addColorStop(0.5, star.colour);
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    c.strokeStyle = lg;
    c.beginPath();
    c.moveTo(sx - dx * spike, sy - dy * spike);
    c.lineTo(sx + dx * spike, sy + dy * spike);
    c.stroke();
  }

  c.globalAlpha = a * 0.85;
  c.fillStyle = star.colour;
  c.beginPath();
  c.arc(sx, sy, r * 0.46, 0, Math.PI * 2);
  c.fill();

  c.globalAlpha = a * 0.7;
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(sx, sy, r * 0.21 * pulse, 0, Math.PI * 2);
  c.fill();
  c.restore();

  if (f.selected === star) drawReticle(c, sx, sy, r * 1.5 + 9, t);
}

/**
 * Mass: a tilted accretion disc whose reach and weight grow with the lines
 * changed, on a log scale. Size already means neglect, so cost gets its own mark.
 */
export function drawMass(
  f: SkyFrame,
  star: SkyStar,
  sx: number,
  sy: number,
  r: number,
  a: number,
  c: CanvasRenderingContext2D,
): void {
  const m = Math.log10((star.cost ?? 0) + 1);
  if (m < 1.3) return; // under twenty lines there is nothing to weigh
  const reach = r * (1.5 + m * 0.75);
  const tilt = 0.34;
  const spin = f.frozen ? star.spin : star.spin + f.t * 0.12;
  c.save();
  c.translate(sx, sy);
  c.rotate(spin * 0.2 - 0.35);
  for (const [k, alpha] of [
    [1, 0.28],
    [0.78, 0.18],
    [1.22, 0.1],
  ]) {
    c.globalAlpha = a * alpha * Math.min(1, m / 3);
    c.strokeStyle = star.quick ? QUICK_COLOUR : star.colour;
    c.lineWidth = Math.max(0.6, m * 0.55);
    c.setLineDash([reach * 0.5, reach * 0.18]);
    c.lineDashOffset = spin * reach;
    c.beginPath();
    c.ellipse(0, 0, reach * k, reach * k * tilt, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}

export function drawClusterLabel(f: SkyFrame, cluster: SkyCluster): void {
  if (!cluster.stars.length || cluster.halo) return;
  const { ctx } = f;
  const scale = f.camera.current.scale;
  const [sx, sy] = f.toScreen(cluster.cx, cluster.labelY, cluster.z);
  const a = f.dimCluster(cluster);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.9 * a;
  ctx.fillStyle = cluster.colour;
  ctx.font = `italic 300 ${Math.max(18, 30 * Math.min(scale, 1.2))}px "Cormorant Garamond", Georgia, serif`;
  ctx.fillText(cluster.label, sx, sy);
  ctx.globalAlpha = 0.5 * a;
  ctx.fillStyle = '#8d9bc4';
  ctx.font = `500 ${Math.max(9, 10.5 * Math.min(scale, 1.2))}px "IBM Plex Mono", monospace`;
  ctx.fillText(cluster.sub, sx, sy + 20);
  ctx.restore();
}

export function drawStarLabel(f: SkyFrame, star: SkyStar): void {
  if (star.custom) return;
  const grow = f.born(star);
  if (grow < 0.6 || !star.tag) return;
  const { ctx } = f;
  const [sx, sy] = f.toScreen(star.ax, star.ay, star.az);
  const r = starRadius(f, star, 1);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.85 * f.dim(star) * grow;
  ctx.fillStyle = '#eaf0ff';
  ctx.font = '500 11px "IBM Plex Mono", monospace';
  ctx.fillText(star.tag, sx, sy + r * 1.6 + 17);
  if (star.quick) {
    ctx.fillStyle = QUICK_COLOUR;
    ctx.fillText('✦ quick win', sx, sy - r * 1.6 - 10);
  }
  if (f.camera.current.scale > 1.35) {
    ctx.globalAlpha = 0.5 * f.dim(star) * grow;
    ctx.fillStyle = '#8d9bc4';
    ctx.font = '300 10.5px "IBM Plex Sans", sans-serif';
    const words = star.caption.length > 40 ? `${star.caption.slice(0, 38)}…` : star.caption;
    ctx.fillText(words, sx, sy + r * 1.6 + 31);
  }
  ctx.restore();
}

function drawVignette(f: SkyFrame): void {
  const { ctx, width, height } = f;
  const g = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.32,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.78,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.72)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

const WISPS = (() => {
  const r = rnd(4242);
  return Array.from({ length: 8 }, () => ({
    x: r(),
    y: r(),
    s: 0.35 + r() * 0.5,
    v: 0.004 + r() * 0.01,
    p: r() * 6,
  }));
})();

/** The sky fogs over as its data ages. */
export function drawFog(f: SkyFrame): void {
  const level = f.fog;
  if (level <= 0) return;
  const { ctx, width, height, t } = f;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(44, 52, 80, ${0.42 * level})`;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'screen';
  const span = Math.max(width, height);
  for (const w of WISPS) {
    const x = (((w.x + (f.frozen ? 0 : t * w.v)) % 1.4) - 0.2) * width;
    const y = (w.y + Math.sin(t * 0.05 + w.p) * 0.04) * height;
    const rad = span * w.s;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(150, 162, 200, ${0.16 * level})`);
    g.addColorStop(1, 'rgba(150, 162, 200, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  ctx.restore();
}

/** The whole sky in Canvas 2D, with a half-resolution glow layer for bloom. */
export class CanvasSkyRenderer implements SkyRenderer {
  readonly kind = 'canvas';
  private readonly glow: HTMLCanvasElement;
  private readonly grain: HTMLCanvasElement;
  private nebula: HTMLCanvasElement | null = null;

  constructor(
    private readonly document: Document,
    private readonly view: () => { readonly width: number; readonly height: number },
    private readonly project: (x: number, y: number) => [number, number],
  ) {
    this.glow = document.createElement('canvas');
    this.grain = buildGrain(document);
    this.resize();
  }

  mount(): void {
    return;
  }

  setScene(): void {
    return;
  }

  toScreen(x: number, y: number): [number, number] {
    return this.project(x, y);
  }

  resize(): void {
    // The bloom layer runs at half resolution: it is about to be blurred, so
    // the detail would be thrown away anyway, and it quarters the fill cost.
    const { width, height } = this.view();
    this.glow.width = Math.max(2, Math.floor(width / 2));
    this.glow.height = Math.max(2, Math.floor(height / 2));
  }

  dispose(): void {
    return;
  }

  frame(f: SkyFrame): void {
    const { ctx, width, height } = f;
    this.drawSpace(f);
    drawGrid(f);

    const gctx = this.glow.getContext('2d');
    if (gctx) {
      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.clearRect(0, 0, this.glow.width, this.glow.height);
      gctx.save();
      gctx.scale(0.5, 0.5);
      gctx.globalCompositeOperation = 'lighter';
      if (f.chart === 'prs') drawFlow(f, gctx);
      for (const layer of f.layers) layer.beneath?.(gctx, f);
      for (const c of f.clusters) drawCluster(f, c, gctx);
      for (const s of f.stars) drawStar(f, s, gctx);
      for (const layer of f.layers) layer.above?.(gctx, f);
      gctx.restore();

      // Two radii: a tight halo for shape, a wide one for atmosphere, then the
      // unblurred layer last so the cores stay sharp inside their own glow.
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'blur(6px)';
      ctx.globalAlpha = 0.7;
      ctx.drawImage(this.glow, 0, 0, width, height);
      ctx.filter = 'blur(22px)';
      ctx.globalAlpha = 0.22;
      ctx.drawImage(this.glow, 0, 0, width, height);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.drawImage(this.glow, 0, 0, width, height);
    }

    ctx.globalCompositeOperation = 'source-over';
    for (const layer of f.layers) layer.flat?.(ctx, f);
    drawCustomReticle(f);
    for (const c of f.clusters) drawClusterLabel(f, c);
    if (f.camera.current.scale > 0.5) for (const s of f.stars) drawStarLabel(f, s);
    for (const layer of f.layers) layer.labels?.(ctx, f);

    drawFog(f);
    drawVignette(f);
    this.drawGrain(f);
  }

  private drawSpace(f: SkyFrame): void {
    const { ctx, width, height } = f;
    const g = ctx.createRadialGradient(
      width * 0.5,
      height * 0.46,
      0,
      width * 0.5,
      height * 0.46,
      Math.max(width, height) * 0.85,
    );
    // Deep space is mostly black: a hint of where the galaxy lies, not a wash.
    g.addColorStop(0, '#0a1330');
    g.addColorStop(0.42, '#060a1c');
    g.addColorStop(1, '#03050c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    this.drawNebula(f);
    this.drawField(f);
  }

  private drawNebula(f: SkyFrame): void {
    this.nebula ??= buildNebula(this.document);
    const nebula = this.nebula;
    const { ctx, width, height, t } = f;
    const cam = f.camera.current;
    const scale = (Math.max(width, height) / 520) * (0.9 + cam.scale * 0.22);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Two copies at different depths and rotations read as volume.
    for (const [depth, alpha, spin, zoom] of [
      [0.16, 0.42, 0.028, 1],
      [0.34, 0.2, -0.019, 1.4],
    ]) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(
        width / 2 - cam.x * cam.scale * depth + Math.sin(t * 0.115) * 78,
        height / 2 - cam.y * cam.scale * depth + Math.cos(t * 0.094) * 60,
      );
      ctx.rotate(t * spin);
      ctx.scale(scale * zoom, scale * zoom);
      ctx.drawImage(nebula, -nebula.width / 2, -nebula.height / 2);
      ctx.restore();
    }
    ctx.restore();
  }

  private drawField(f: SkyFrame): void {
    const { ctx, width, height, t } = f;
    const cam = f.camera.current;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of f.field) {
      const sx = (s.x - cam.x) * cam.scale * s.depth + width / 2;
      const sy = (s.y - cam.y) * cam.scale * s.depth + height / 2;
      if (sx < -10 || sy < -10 || sx > width + 10 || sy > height + 10) continue;
      const tw = 0.62 + Math.sin(t * s.rate + s.phase) * 0.38;
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = s.tint;
      ctx.beginPath();
      ctx.arc(sx, sy, s.r * (0.85 + tw * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Grain hides the banding that large soft gradients produce. */
  private drawGrain(f: SkyFrame): void {
    const { ctx, width, height, t } = f;
    const ox = f.frozen ? 0 : (Math.sin(t * 37) * 64) | 0;
    const oy = f.frozen ? 0 : (Math.cos(t * 41) * 64) | 0;
    const pattern = ctx.createPattern(this.grain, 'repeat');
    if (!pattern) return;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.045;
    ctx.translate(ox, oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(
      -ox - GRAIN_TILE,
      -oy - GRAIN_TILE,
      width + GRAIN_TILE * 2,
      height + GRAIN_TILE * 2,
    );
    ctx.restore();
  }
}
