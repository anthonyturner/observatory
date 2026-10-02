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
import { AUDIO_TAP, AudioTap, NoTabAudioError, TabAudioUnsupportedError } from './tab-audio';

/** The music the page hears from its own tab, for the sky to move with.
 *  Provided by the page, so leaving it stops listening. */
@Injectable()
export class MusicPulse {
  private readonly openTap = inject(AUDIO_TAP);
  private readonly errors = inject(ErrorHandler);
  private readonly currentStatus = signal<SyncStatus>('off');
  private tap: AudioTap | null = null;
  private bins = new Uint8Array(0);
  private analysis = new MusicAnalysis();
  private hasAsked = false;

  readonly status: Signal<SyncStatus> = this.currentStatus.asReadonly();
  readonly isListening = computed(() => this.currentStatus() === 'listening');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.release());
  }

  /** Asks to hear the tab, unless this visit already asked. */
  listenOnce(): void {
    if (!this.hasAsked) this.listen();
  }

  /** Asks to hear the tab; call it from a click, as the browser requires. */
  listen(): void {
    if (this.currentStatus() === 'asking' || this.tap) return;
    this.hasAsked = true;
    this.currentStatus.set('asking');
    this.openTap()
      .then((tap) => this.attach(tap))
      .catch((error: unknown) => this.refused(error));
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
    this.currentStatus.set('listening');
  }

  private refused(error: unknown): void {
    if (error instanceof NoTabAudioError) this.currentStatus.set('no-audio');
    else if (error instanceof TabAudioUnsupportedError) this.currentStatus.set('unsupported');
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
  }
}
