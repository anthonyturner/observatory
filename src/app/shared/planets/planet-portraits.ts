import { DOCUMENT, Injectable, Signal, inject, signal } from '@angular/core';
import { PortraitPainter } from './planet-portrait.types';

/**
 * The page's one portrait painter, loaded with Three.js the first time a view
 * asks for it. It stays null where WebGL cannot start, so views keep drawing
 * flat bodies.
 */
@Injectable({ providedIn: 'root' })
export class PlanetPortraits {
  private readonly document = inject(DOCUMENT);
  private readonly loaded = signal<PortraitPainter | null>(null);
  private isRequested = false;

  /** Starts loading on the first call; later calls return the same painter. */
  painter(): Signal<PortraitPainter | null> {
    if (!this.isRequested) {
      this.isRequested = true;
      import('./webgl-portrait-painter')
        .then(async ({ WebglPortraitPainter }) => {
          const painter = new WebglPortraitPainter(this.document);
          // Views keep their flat bodies until the shaders have compiled off the main thread.
          await painter.compile();
          this.loaded.set(painter);
        })
        .catch((error: unknown) =>
          console.warn('Planet portraits are unavailable; drawing flat bodies.', error),
        );
    }
    return this.loaded.asReadonly();
  }
}
