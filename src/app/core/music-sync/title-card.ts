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
/** Where the line's baseline sits below the core's centre, in core radii: in
 *  the band between the core and the name under it, which starts at least
 *  1.47 radii down (the core is at most 0.34 of its box's height). */
const BASELINE_BELOW_CORE = 1.3;
/** The title's size, in core radii, kept readable and inside the band. */
const TITLE_SIZE = 0.17;
const MIN_TITLE_PX = 13;
const MAX_TITLE_PX = 30;
/** The artist is set smaller, spaced, after a gap, on the same line. */
const ARTIST_SHARE = 0.62;
const ARTIST_GAP_EM = 0.9;
const ARTIST_SPACING = '0.3em';
/** The line never runs wider than this share of the screen. */
const MAX_WIDTH_SHARE = 0.8;
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
    const titlePx = Math.min(MAX_TITLE_PX, Math.max(MIN_TITLE_PX, scene.coreRadius * TITLE_SIZE));
    const artistPx = titlePx * ARTIST_SHARE;
    const titleFont = `600 ${titlePx}px ${this.fontFamily}`;
    const artistFont = `500 ${artistPx}px ${this.fontFamily}`;
    const artist = this.song.artist.toUpperCase();
    context.save();
    context.font = titleFont;
    const titleWidth = context.measureText(this.song.title).width;
    context.font = artistFont;
    context.letterSpacing = ARTIST_SPACING;
    const artistWidth = context.measureText(artist).width;
    const gap = titlePx * ARTIST_GAP_EM;
    const width = titleWidth + gap + artistWidth;
    const fit = Math.min(1, (scene.width * MAX_WIDTH_SHARE) / width);
    const swell = (1 + BEAT_SWELL * this.pulse) * fit;
    context.translate(scene.originX, scene.originY + scene.coreRadius * BASELINE_BELOW_CORE);
    context.scale(swell, swell);
    context.globalAlpha = opacity;
    // Painted over the look rather than added to it, so a bright preset never washes it out.
    context.globalCompositeOperation = 'source-over';
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.shadowBlur = GLOW_PX;
    context.shadowColor = inks.primary;
    context.fillStyle = inks.primary;
    context.fillText(artist, -width / 2 + titleWidth + gap, 0);
    context.letterSpacing = '0px';
    context.font = titleFont;
    context.fillStyle = inks.accent;
    context.fillText(this.song.title, -width / 2, 0);
    context.restore();
  }
}
