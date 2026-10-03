import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  ErrorHandler,
  afterNextRender,
  computed,
  effect,
  inject,
} from '@angular/core';
import { CoreGeometry } from '../../../core/instrument/core-geometry';
import { FrameLoop } from '../../../core/instrument/frame-loop';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { MilkdropChoice } from '../../../core/music-sync/milkdrop/milkdrop-choice';
import { MilkdropOpacity } from '../../../core/music-sync/milkdrop/milkdrop-opacity';
import { MusicScene } from '../../../core/music-sync/motifs/motif-layer';
import { MUSIC_CANVAS, MusicCanvas } from '../../../core/music-sync/music-painter';
import { MusicPulse } from '../../../core/music-sync/music-pulse';
import { MusicSkyPresence } from '../../../core/music-sync/music-sky-presence';
import { sameTheme, themeFor } from '../../../core/music-sync/visual-theme';
import { PlaylistPlayer } from '../../../core/playlist/playlist-player';
import { VideoBackground } from '../../../core/playlist/video-background';

/** Smooth enough for a kick to land on time. */
const MUSIC_FPS = 60;
const MAX_PIXEL_RATIO = 2;
/** Where the core would be before one is measured, as fractions of the window. */
const DEFAULT_ORIGIN = { x: 0.5, y: 0.4 } as const;
const DEFAULT_CORE_RADIUS = 120;

/** The music over the sky and under the HUD: it moves only while the page is
 *  listening to its tab and motion is on, and takes no pointer. */
@Component({
  selector: 'app-music-sky',
  template: '',
  styleUrl: './music-sky.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class MusicSky {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly geometry = inject(CoreGeometry);
  private readonly motion = inject(MotionPreference);
  private readonly errors = inject(ErrorHandler);
  private readonly pulse = inject(MusicPulse);
  private readonly playlist = inject(PlaylistPlayer);
  private readonly milkdropOpacity = inject(MilkdropOpacity);
  private readonly videoBackground = inject(VideoBackground);
  private readonly makeCanvas = inject(MUSIC_CANVAS);
  private readonly milkdropChoice = inject(MilkdropChoice);
  /** The song playing, by name; it changes only when the song does. */
  private readonly song = computed(
    () => {
      const { title, artist } = this.playlist.current();
      return { title, artist };
    },
    { equal: (a, b) => a.title === b.title && a.artist === b.artist },
  );
  private readonly theme = computed(
    () => themeFor(this.playlist.current(), this.playlist.elapsed()),
    // The position ticks several times a second; the look changes every few minutes.
    { equal: sameTheme },
  );
  /** The video takes Milkdrop's place behind the page while it is on. */
  private readonly milkdropLevel = computed(() =>
    this.videoBackground.isOn() ? 0 : this.milkdropOpacity.level(),
  );
  private readonly isMoving = computed(() => this.pulse.isListening() && !this.motion.isStill());
  private painter: MusicCanvas | null = null;
  private loop: FrameLoop | null = null;
  private lastWall: number | null = null;

  constructor() {
    // The playlist bar offers the sky's controls while this sky is on the page.
    inject(DestroyRef).onDestroy(inject(MusicSkyPresence).hold());
    afterNextRender(() => this.start());
    effect(() => {
      // Read before the painter exists too, or the effect never learns to rerun.
      const theme = this.theme();
      this.painter?.setTheme(theme);
    });
    effect(() => {
      const level = this.milkdropLevel();
      this.painter?.setMilkdropOpacity(level);
    });
    effect(() => {
      const song = this.song();
      this.painter?.announce(song);
    });
    effect(() => {
      const sound = this.pulse.sound();
      this.painter?.setSound(sound);
    });
    effect(() => {
      const preset = this.milkdropChoice.preset();
      this.painter?.setMilkdropPreset(preset);
    });
    effect(() => {
      this.geometry.view();
      this.place();
    });
    effect(() => {
      if (this.isMoving()) this.loop?.kick();
      else this.rest();
    });
    inject(DestroyRef).onDestroy(() => {
      this.loop?.stop();
      this.painter?.dispose();
    });
  }

  private start(): void {
    const painter = this.makeCanvas(this.host.nativeElement);
    if (!painter.canDraw()) return painter.dispose();
    this.painter = painter;
    painter.setTheme(this.theme());
    painter.setSound(this.pulse.sound());
    painter.setMilkdropPreset(this.milkdropChoice.preset());
    painter.announce(this.song());
    painter.setMilkdropOpacity(this.milkdropLevel());
    this.place();
    const window = this.document.defaultView;
    this.loop = new FrameLoop({
      scheduler: {
        request: (callback) => window?.requestAnimationFrame(callback),
        isHidden: () => this.document.hidden,
        nowMs: () => performance.now(),
      },
      draw: (_time, wall) => this.draw(wall),
      framesPerSecond: () => MUSIC_FPS,
      // Not moving counts as still: the loop then draws one last frame and rests.
      isStill: () => !this.isMoving(),
      onError: (error) => this.errors.handleError(error),
    });
    if (this.isMoving()) this.loop.kick();
  }

  private draw(wall: number): void {
    if (!this.isMoving()) return this.rest();
    const stepS = this.lastWall === null ? 0 : wall - this.lastWall;
    this.lastWall = wall;
    this.painter?.paint(this.pulse.sample(wall), stepS);
  }

  private rest(): void {
    this.lastWall = null;
    this.painter?.clear();
  }

  private place(): void {
    const window = this.document.defaultView;
    if (!this.painter || !window) return;
    this.painter.setScene(
      sceneOf(this.geometry, window),
      Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
    );
  }
}

function sceneOf(geometry: CoreGeometry, window: Window): MusicScene {
  const view = geometry.view();
  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    width,
    height,
    originX: view?.centreX ?? width * DEFAULT_ORIGIN.x,
    originY: view?.centreY ?? height * DEFAULT_ORIGIN.y,
    coreRadius: view?.radius ?? DEFAULT_CORE_RADIUS,
  };
}
