import { MusicInks, MusicScene } from './motifs/motif-layer';
import { MusicFrame } from './music-sync.types';

/** A song's name, as the sky shows it. */
export interface SongName {
  readonly title: string;
  readonly artist: string;
}

/** The card fades in, holds, then fades out, in seconds. */
const FADE_IN_S = 0.6;
const HOLD_S = 4.5;
const FADE_OUT_S = 1.4;
/** How far below the core's centre the card sits, in core radii, and the
 *  lowest it may sit, as a share of the screen's height: above the bar. */
const BELOW_CORE = 2.1;
const LOWEST = 0.78;
const TITLE_PX = 40;
const ARTIST_PX = 18;
const LINE_GAP_PX = 14;
/** The title never runs wider than this share of the screen. */
const MAX_WIDTH_SHARE = 0.8;
const ARTIST_SPACING = '0.3em';
const GLOW_PX = 18;
/** How much bigger the card is at the height of a beat. */
const BEAT_SWELL = 0.05;

/** A song's title and artist, faded into the sky as the song starts and
 *  swelling on the beat. Time only passes while the sky draws, so a song
 *  announced before the music moves is shown once it does. */
export class TitleCard {
  private song: SongName | null = null;
  private ageS = 0;
  private pulse = 0;

  constructor(private readonly fontFamily: string) {}

  /** Shows `song`, from the start of its fade. */
  announce(song: SongName): void {
    this.song = song;
    this.ageS = 0;
  }

  step(frame: MusicFrame, stepS: number): void {
    if (!this.song) return;
    this.ageS += stepS;
    this.pulse = frame.pulse;
    if (this.ageS >= FADE_IN_S + HOLD_S + FADE_OUT_S) this.song = null;
  }

  /** How visible the card is now, from 0 to 1. */
  opacity(): number {
    if (!this.song) return 0;
    if (this.ageS < FADE_IN_S) return this.ageS / FADE_IN_S;
    const fadingS = this.ageS - FADE_IN_S - HOLD_S;
    return fadingS <= 0 ? 1 : Math.max(0, 1 - fadingS / FADE_OUT_S);
  }

  draw(context: CanvasRenderingContext2D, scene: MusicScene, inks: MusicInks): void {
    const opacity = this.opacity();
    if (!this.song || opacity <= 0) return;
    const x = scene.originX;
    const y = Math.min(scene.originY + scene.coreRadius * BELOW_CORE, scene.height * LOWEST);
    const swell = 1 + BEAT_SWELL * this.pulse;
    context.save();
    context.translate(x, y);
    context.scale(swell, swell);
    context.globalAlpha = opacity;
    // Painted over the look rather than added to it, so a bright preset never washes it out.
    context.globalCompositeOperation = 'source-over';
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    context.shadowBlur = GLOW_PX;
    context.shadowColor = inks.primary;
    context.fillStyle = inks.accent;
    context.font = `600 ${TITLE_PX}px ${this.fontFamily}`;
    context.fillText(this.song.title, 0, 0, scene.width * MAX_WIDTH_SHARE);
    context.fillStyle = inks.primary;
    context.font = `500 ${ARTIST_PX}px ${this.fontFamily}`;
    context.letterSpacing = ARTIST_SPACING;
    context.fillText(
      this.song.artist.toUpperCase(),
      0,
      ARTIST_PX + LINE_GAP_PX,
      scene.width * MAX_WIDTH_SHARE,
    );
    context.restore();
  }
}
