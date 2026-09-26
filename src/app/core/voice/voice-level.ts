import { DOCUMENT, Injectable, InjectionToken, Signal, inject, signal } from '@angular/core';

/** Calls back on the next frame; a test drives it by hand. */
export const NEXT_FRAME = new InjectionToken<(callback: () => void) => void>('NextFrame', {
  providedIn: 'root',
  factory: () => {
    const window = inject(DOCUMENT).defaultView;
    return (callback) => window?.requestAnimationFrame(callback);
  },
});

/** How loud the voice is now, 0 to 1: the mic while it listens, the reply
 *  while one is read aloud, and nothing otherwise. One source at a time. */
@Injectable({ providedIn: 'root' })
export class VoiceLevel {
  private readonly nextFrame = inject(NEXT_FRAME);
  private readonly current = signal(0);
  private source: (() => number) | null = null;

  readonly level: Signal<number> = this.current.asReadonly();

  /** Reads `source` once a frame until the returned function is called. */
  follow(source: () => number): () => void {
    this.source = source;
    this.nextFrame(() => this.tick(source));
    return () => {
      if (this.source !== source) return;
      this.source = null;
      this.current.set(0);
    };
  }

  private tick(source: () => number): void {
    if (this.source !== source) return;
    this.current.set(source());
    this.nextFrame(() => this.tick(source));
  }
}
