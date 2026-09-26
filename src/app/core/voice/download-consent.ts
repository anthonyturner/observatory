import { DOCUMENT, Injectable, InjectionToken, inject } from '@angular/core';
import { ModelLoader } from './model-loader';
import { VoiceStatus } from './voice-status';

/** The browser's storage quota and use, in bytes. */
export interface StorageRoom {
  readonly quota: number;
  readonly usage: number;
}

export const STORAGE_ROOM = new InjectionToken<() => Promise<StorageRoom>>('StorageRoom', {
  providedIn: 'root',
  factory: () => {
    const storage = inject(DOCUMENT).defaultView?.navigator.storage;
    return async () => {
      const estimate = await storage?.estimate();
      if (estimate?.quota === undefined) throw new Error('No storage estimate in this browser');
      return { quota: estimate.quota, usage: estimate.usage ?? 0 };
    };
  },
});

const BYTES_PER_MB = 1e6;
/** Room enough to keep a download is its size and a fifth more. */
const ROOM_MARGIN = 1.2;

export interface ConsentRequest {
  /** Runs when the viewer agrees, after the download has started. */
  readonly onAgreed?: () => void;
  /** Whether the question takes the focus; not when it comes unasked. */
  readonly takesFocus: boolean;
}

/** Asks before a model's first download, with its size, and says so if the
 *  browser has too little room to keep it. */
@Injectable({ providedIn: 'root' })
export class DownloadConsent {
  private readonly status = inject(VoiceStatus);
  private readonly room = inject(STORAGE_ROOM);

  async ask(loader: ModelLoader, request: ConsentRequest): Promise<void> {
    const words = await this.question(loader);
    const control = loader.spec.control;
    this.status.ask(
      words,
      [
        {
          label: 'Download',
          kind: 'go',
          focusAfter: control,
          run: () => {
            // A failure reaches the loader's owner, which says what it means.
            loader.load().catch(() => undefined);
            request.onAgreed?.();
          },
        },
        { label: 'Not now', kind: 'quiet', focusAfter: control, run: () => this.status.clear() },
      ],
      request.takesFocus,
    );
  }

  private async question(loader: ModelLoader): Promise<string> {
    const { what, privacy, paths } = loader.spec;
    const path = loader.currentPath();
    const fallback =
      path.device === 'webgpu'
        ? ` If the graphics card cannot run it, Home downloads the processor’s version (about ${paths.cpu.mb} MB) instead.`
        : '';
    const room = (await this.hasRoomFor(path.mb))
      ? ''
      : ' This browser has too little storage to keep it, so it would download again next time.';
    return `${privacy} The first use downloads a ${what} (about ${path.mb} MB), once.${fallback}${room}`;
  }

  /** Unknown room is no reason to refuse. */
  private async hasRoomFor(mb: number): Promise<boolean> {
    try {
      const { quota, usage } = await this.room();
      return quota - usage >= mb * BYTES_PER_MB * ROOM_MARGIN;
    } catch {
      return true;
    }
  }
}
