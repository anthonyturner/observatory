import type { PcmListener, PcmSource } from './pcm-source.ts';

/** One listener's hold on the capture. */
export interface Listening {
  /** Settles once the capture is running; rejects when it could not start. */
  readonly ready: Promise<void>;
  /** Lets go; the capture stops when the last listener has. */
  stop(): void;
}

interface Running {
  readonly stop: () => void;
  readonly listeners: Set<PcmListener>;
  readonly ready: Promise<void>;
}

/**
 * The computer's sound shared by every listener: one capture, started for
 * the first and stopped when the last one leaves.
 */
export class SoundCardCapture {
  private running: Running | null = null;
  private readonly source: PcmSource;

  constructor(source: PcmSource) {
    this.source = source;
  }

  get listenerCount(): number {
    return this.running?.listeners.size ?? 0;
  }

  listen(listener: PcmListener): Listening {
    const running = this.running ?? this.start();
    running.listeners.add(listener);
    return { ready: running.ready, stop: () => this.leave(running, listener) };
  }

  private start(): Running {
    const listeners = new Set<PcmListener>();
    let started = (): void => undefined;
    let failed = (_problem: string): void => undefined;
    const ready = new Promise<void>((resolve, reject) => {
      started = resolve;
      failed = (problem) => reject(new Error(problem));
    });
    // A listener that lets go before it awaited `ready` must not leave a rejection unheard.
    ready.catch(() => undefined);
    let stopSource = (): void => undefined;
    const running: Running = { stop: () => stopSource(), listeners, ready };
    this.running = running;
    stopSource = this.source({
      started,
      data: (chunk) => listeners.forEach((listener) => listener.data(chunk)),
      ended: (problem) => {
        if (this.running === running) this.running = null;
        failed(problem ?? 'the sound card capture stopped');
        const left = [...listeners];
        listeners.clear();
        left.forEach((listener) => listener.ended(problem));
      },
    });
    return running;
  }

  private leave(running: Running, listener: PcmListener): void {
    if (!running.listeners.delete(listener) || running.listeners.size) return;
    if (this.running === running) this.running = null;
    running.stop();
  }
}
