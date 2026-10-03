import { ErrorHandler, InjectionToken, inject } from '@angular/core';
import { resolveColour } from '../instrument/palette';
import { Genre } from '../playlist/playlist.types';
import { BeatHit, zoomAnchor } from './beat-hit';
import { DEFAULT_BEAT_STRENGTH } from './beat-strength';
import { Bloom } from './bloom';
import { DEFAULT_MILKDROP_OPACITY } from './milkdrop/milkdrop-opacity';
import { MilkdropStage, loadMilkdrop } from './milkdrop/milkdrop-stage';
import { Milkdrop } from './motifs/milkdrop';
import { Aurora } from './motifs/aurora';
import { MotifLayer, MusicInks, MusicScene, reachOf } from './motifs/motif-layer';
import { Nebula } from './motifs/nebula';
import { Shockwave } from './motifs/shockwave';
import { Warp } from './motifs/warp';
import { MusicFrame } from './music-sync.types';
import { TabSound } from './tab-audio';
import { SongName, TitleCard } from './title-card';
import { Motif, VisualTheme } from './visual-theme';

/** What the music layer draws with, behind a token so a test's DOM, which has
 *  no canvas, can stand in something quiet. */
export interface MusicCanvas {
  canDraw(): boolean;
  setScene(scene: MusicScene, pixelRatio: number): void;
  setTheme(theme: VisualTheme): void;
  /** The tab's sound, for a look that hears it directly. */
  setSound(sound: TabSound | null): void;
  /** The Milkdrop preset to keep on screen, or null for Auto. */
  setMilkdropPreset(preset: string | null): void;
  /** How strongly Milkdrop shows, from 0 (hidden) to 1 (full). */
  setMilkdropOpacity(level: number): void;
  /** How hard each beat hits the sky, from 0 (no hit) to 1 (full). */
  setBeatStrength(level: number): void;
  /** Shows a new song's name in the sky. */
  announce(song: SongName): void;
  paint(frame: MusicFrame, stepS: number): void;
  clear(): void;
  dispose(): void;
}

export const MUSIC_CANVAS = new InjectionToken<(host: HTMLElement) => MusicCanvas>('MUSIC_CANVAS', {
  providedIn: 'root',
  factory: () => {
    const errors = inject(ErrorHandler);
    return (host) => new MusicPainter(host, (error) => errors.handleError(error));
  },
});

const MOTIF_LAYERS: Readonly<Record<Motif, () => MotifLayer>> = {
  shockwave: () => new Shockwave(),
  warp: () => new Warp(),
  aurora: () => new Aurora(),
  nebula: () => new Nebula(),
};

interface Sparkle {
  x: number;
  y: number;
  life: number;
}

interface Burst {
  radius: number;
  life: number;
}

const GLOW_FROM = 1.05;
const GLOW_TO = 4.5;
const GLOW_ALPHA = 0.3;
/** Sparkles each second at full highs; the hats scatter them across the sky. */
const SPARKLES_PER_S = 90;
const SPARKLE_LIFE_S = 0.7;
const SPARKLE_PX = 1.8;
const BURST_SPEED_PX = 900;
const BURST_LIFE_S = 1.6;
const BURST_WIDTH_PX = 18;
const BURST_ALPHA = 0.35;
/** The core stays clear: nothing is drawn inside it, and its edge fades in. */
const HOLE_TO = 1.6;
/** The glow over the whole layer, always on, and how much a beat adds to it. */
const BLOOM_BASE = 0.45;
const BLOOM_BEAT = 0.75;
const MAX_STEP_S = 0.1;

/** Paints the music between the sky and the HUD: the track's Milkdrop preset, a glow that
 *  breathes with the bass, sparkles on the highs, a hit on every beat, the
 *  name of each new song and a burst on a drop, all bloomed and kept off the core so its own pulse reads
 *  through. */
export class MusicPainter implements MusicCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly palettes: Readonly<Record<Genre, MusicInks>>;
  private readonly hit = new BeatHit();
  private readonly bloom: Bloom;
  private readonly milkdrop: MilkdropStage;
  private readonly titleCard: TitleCard;
  private scene: MusicScene | null = null;
  private pixelRatio = 1;
  private motif: MotifLayer = new Shockwave();
  private milkdropOpacity = DEFAULT_MILKDROP_OPACITY;
  private beatStrength = DEFAULT_BEAT_STRENGTH;
  private inks: MusicInks;
  private sparkles: Sparkle[] = [];
  private bursts: Burst[] = [];
  private bass = 0;
  private pulse = 0;

  constructor(host: HTMLElement, onError: (error: unknown) => void) {
    this.canvas = host.ownerDocument.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    host.append(this.canvas);
    this.context = this.canvas.getContext('2d');
    this.bloom = new Bloom(host.ownerDocument);
    this.milkdrop = new MilkdropStage(host.ownerDocument, loadMilkdrop, onError);
    this.palettes = { trance: inksOf(host, 'trance'), techno: inksOf(host, 'techno') };
    this.inks = this.palettes.trance;
    this.titleCard = new TitleCard(fontOf(host));
  }

  canDraw(): boolean {
    return this.context !== null;
  }

  setScene(scene: MusicScene, pixelRatio: number): void {
    if (
      scene.width !== this.scene?.width ||
      scene.height !== this.scene?.height ||
      pixelRatio !== this.pixelRatio
    ) {
      this.canvas.width = Math.floor(scene.width * pixelRatio);
      this.canvas.height = Math.floor(scene.height * pixelRatio);
    }
    this.scene = scene;
    this.pixelRatio = pixelRatio;
  }

  setTheme(theme: VisualTheme): void {
    // Milkdrop always, with the theme's hand-drawn motif standing in until it can draw.
    this.motif = new Milkdrop(
      this.milkdrop,
      theme.variant,
      MOTIF_LAYERS[theme.motif](),
      () => this.milkdropOpacity,
    );
    this.inks = this.palettes[theme.palette];
  }

  setSound(sound: TabSound | null): void {
    this.milkdrop.setSound(sound);
  }

  setMilkdropPreset(preset: string | null): void {
    this.milkdrop.pin(preset);
  }

  setMilkdropOpacity(level: number): void {
    this.milkdropOpacity = level;
  }

  setBeatStrength(level: number): void {
    this.beatStrength = level;
    this.hit.setStrength(level);
  }

  announce(song: SongName): void {
    this.titleCard.announce(song);
  }

  paint(frame: MusicFrame, stepS: number): void {
    const { context, scene } = this;
    if (!context || !scene) return;
    const step = Math.min(Math.max(stepS, 0), MAX_STEP_S);
    this.advance(frame, step, scene);
    this.clear();
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    context.globalCompositeOperation = 'lighter';
    this.drawGlow(context, scene);
    this.drawMotif(context, scene);
    this.drawSparkles(context);
    this.drawBursts(context, scene);
    this.hit.draw(context, scene, this.inks);
    this.bloom.apply(this.canvas, context, BLOOM_BASE + BLOOM_BEAT * this.beatStrength * this.pulse);
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.clearCore(context, scene);
    // After the clearing, which would otherwise rub out the line sitting just above the core.
    this.titleCard.draw(context, scene, this.inks);
  }

  clear(): void {
    this.context?.setTransform(1, 0, 0, 1, 0, 0);
    this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  dispose(): void {
    this.milkdrop.dispose();
    this.canvas.remove();
  }

  private advance(frame: MusicFrame, stepS: number, scene: MusicScene): void {
    this.bass = frame.bass;
    this.pulse = frame.pulse;
    this.motif.step(frame, stepS, scene);
    this.hit.step(frame, stepS, scene);
    this.titleCard.step(frame, stepS);
    this.sparkles = this.sparkles
      .map((sparkle) => ({ ...sparkle, life: sparkle.life - stepS / SPARKLE_LIFE_S }))
      .filter((sparkle) => sparkle.life > 0);
    const born = Math.floor(frame.high * SPARKLES_PER_S * stepS + Math.random());
    for (let i = 0; i < born; i++)
      this.sparkles.push({
        x: Math.random() * scene.width,
        y: Math.random() * scene.height,
        life: 1,
      });
    if (frame.drop) this.bursts.push({ radius: scene.coreRadius, life: 1 });
    this.bursts = this.bursts
      .map((burst) => ({
        radius: burst.radius + BURST_SPEED_PX * stepS,
        life: burst.life - stepS / BURST_LIFE_S,
      }))
      .filter((burst) => burst.life > 0);
  }

  /** The motif, zoomed about the core on the beat, or about the nearest point
   *  on the screen once the core is scrolled away. */
  private drawMotif(context: CanvasRenderingContext2D, scene: MusicScene): void {
    const zoom = this.hit.zoom();
    const anchor = zoomAnchor(scene);
    context.save();
    context.translate(anchor.x, anchor.y);
    context.scale(zoom, zoom);
    context.translate(-anchor.x, -anchor.y);
    this.motif.draw(context, scene, this.inks);
    context.restore();
  }

  private drawGlow(context: CanvasRenderingContext2D, scene: MusicScene): void {
    const { originX: x, originY: y, coreRadius: r } = scene;
    const glow = context.createRadialGradient(x, y, r * GLOW_FROM, x, y, r * GLOW_TO);
    glow.addColorStop(0, this.inks.primary);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalAlpha = GLOW_ALPHA * this.bass;
    context.fillStyle = glow;
    context.fillRect(0, 0, scene.width, scene.height);
  }

  private drawSparkles(context: CanvasRenderingContext2D): void {
    context.fillStyle = this.inks.accent;
    for (const sparkle of this.sparkles) {
      context.globalAlpha = sparkle.life;
      context.fillRect(sparkle.x, sparkle.y, SPARKLE_PX, SPARKLE_PX);
    }
  }

  private drawBursts(context: CanvasRenderingContext2D, scene: MusicScene): void {
    const reach = reachOf(scene);
    context.strokeStyle = this.inks.secondary;
    for (const burst of this.bursts) {
      context.globalAlpha = BURST_ALPHA * burst.life;
      context.lineWidth = BURST_WIDTH_PX * burst.life;
      context.beginPath();
      context.arc(scene.originX, scene.originY, Math.min(burst.radius, reach), 0, Math.PI * 2);
      context.stroke();
    }
  }

  private clearCore(context: CanvasRenderingContext2D, scene: MusicScene): void {
    const { originX: x, originY: y, coreRadius: r } = scene;
    // From the centre out: a gradient starting at the core's edge would leave the core unpainted.
    const hole = context.createRadialGradient(x, y, 0, x, y, r * HOLE_TO);
    hole.addColorStop(0, 'rgba(0,0,0,1)');
    hole.addColorStop(1 / HOLE_TO, 'rgba(0,0,0,1)');
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalCompositeOperation = 'destination-out';
    context.globalAlpha = 1;
    context.fillStyle = hole;
    context.beginPath();
    context.arc(x, y, r * HOLE_TO, 0, Math.PI * 2);
    context.fill();
  }
}

/** The face the song's name is set in: the site's condensed sans. */
function fontOf(host: HTMLElement): string {
  const view = host.ownerDocument.defaultView;
  const font = view?.getComputedStyle(host).getPropertyValue('--font-condensed').trim();
  return font || 'sans-serif';
}

function inksOf(host: HTMLElement, genre: Genre): MusicInks {
  return {
    primary: resolveColour(host, `var(--music-${genre}-primary)`),
    secondary: resolveColour(host, `var(--music-${genre}-secondary)`),
    accent: resolveColour(host, `var(--music-${genre}-accent)`),
  };
}
