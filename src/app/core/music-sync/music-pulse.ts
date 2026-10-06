import {
  DestroyRef,
  ErrorHandler,
  Injectable,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { bandLevels } from './band-levels';
import { MusicAnalysis } from './music-analysis';
import { MusicFrame, SILENCE, SyncStatus } from './music-sync.types';
import { AudioTap, CaptureUnsupportedError, LiveSound, NoAudioError } from './sources/audio-tap';
import { SoundSourceChoice } from './sources/sound-source-choice';

/** The music the app hears from the chosen source, for the sky to move with. One
 *  for the whole app, so listening carries on, like the playlist, from page to page. */
@Injectable({ providedIn: 'root' })
export class MusicPulse {
  private readonly choice = inject(SoundSourceChoice);
  private readonly errors = inject(ErrorHandler);
  private readonly currentStatus = signal<SyncStatus>('off');
  private readonly currentSound = signal<LiveSound | null>(null);
  private tap: AudioTap | null = null;
  private bins = new Uint8Array(0);
  private analysis = new MusicAnalysis();
  private hasAsked = false;

  readonly status: Signal<SyncStatus> = this.currentStatus.asReadonly();
  /** False where the browser can use no source, as on a phone, so listening never can. */
  readonly canListen = computed(() => this.choice.selected() !== null);
  readonly isListening = computed(() => this.currentStatus() === 'listening');
  readonly isAsking = computed(() => this.currentStatus() === 'asking');
  /** The sound while listening, for a visualizer that hears it directly. */
  readonly sound: Signal<LiveSound | null> = this.currentSound.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.release());
  }

  /** Asks to hear the chosen source, unless this visit already asked or never could. */
  listenOnce(): void {
    if (!this.hasAsked && this.canListen()) this.listen();
  }

  /** Asks to hear the chosen source; call it from a click, as the browser requires. */
  listen(): void {
    const selected = this.choice.selected();
    if (this.currentStatus() === 'asking' || this.tap || !selected) return;
    this.hasAsked = true;
    this.currentStatus.set('asking');
    selected.source
      .open(selected.option.id)
      .then((tap) => this.attach(tap))
      .catch((error: unknown) => this.refused(error));
  }

  /** Hears the entry `optionId` from now on, at once if already listening; call it
   *  from the input that picked it, as the browser requires. */
  switchTo(optionId: string): void {
    const wasListening = this.isListening();
    this.choice.choose(optionId);
    this.stop();
    if (wasListening) this.listen();
  }

  stop(): void {
    this.release();
    this.currentStatus.set('off');
  }

  /** The music at `timeS` seconds; silence while not listening. */
  sample(timeS: number): MusicFrame {
    if (!this.tap) return SILENCE;
    this.tap.read(this.bins);
    return this.analysis.read(bandLevels(this.bins, this.tap.binHz), timeS);
  }

  private attach(tap: AudioTap): void {
    this.tap = tap;
    this.bins = new Uint8Array(tap.binCount);
    this.analysis = new MusicAnalysis();
    tap.onEnded(() => this.stop());
    this.currentSound.set(tap.sound ?? null);
    this.currentStatus.set('listening');
  }

  private refused(error: unknown): void {
    if (error instanceof NoAudioError) this.currentStatus.set('no-audio');
    else if (error instanceof CaptureUnsupportedError) this.currentStatus.set('unsupported');
    else if (error instanceof DOMException && error.name === 'NotAllowedError')
      this.currentStatus.set('denied');
    else {
      this.currentStatus.set('off');
      this.errors.handleError(error);
    }
  }

  private release(): void {
    this.tap?.close();
    this.tap = null;
    this.currentSound.set(null);
  }
}
