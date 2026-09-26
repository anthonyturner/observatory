import { Signal, computed, signal } from '@angular/core';
import { ModelPath, PathKey } from './model-paths';
import { ModelSpec } from './model-specs';
import {
  LoadWordsInput,
  capitalized,
  fallbackWords,
  loadedFraction,
  loadingWords,
} from './load-words';
import { VoiceError, kindOf, messageOf } from './voice-error';
import { VoiceNarration } from './voice-narration';
import { VoiceStatus } from './voice-status';
import { VoiceWorkerClient } from './voice-worker-client';

/** What a model's load means for the control it serves. */
export interface ModelOwner {
  /** Whether a lost model should load again now. */
  isWanted(): boolean;
  failed(error: VoiceError): void;
}

export interface LoaderServices {
  readonly client: VoiceWorkerClient;
  readonly probe: () => Promise<PathKey>;
  readonly status: VoiceStatus;
  readonly narration: VoiceNarration;
}

interface LoaderState {
  readonly path: PathKey | null;
  readonly hasFallenBack: boolean;
  readonly isLoaded: boolean;
}

const FRESH: LoaderState = { path: null, hasFallenBack: false, isLoaded: false };

/** Loads one model once per visit, on first use and never with the page: on
 *  the graphics card, then, if that fails for any reason but the network, on
 *  the processor. */
export class ModelLoader {
  private readonly state = signal(FRESH);
  private readonly ring = signal<number | null>(null);
  private loading: Promise<void> | null = null;
  /** Bumped whenever a load in flight stops counting: unloaded, lost or forgotten. */
  private attempt = 0;

  /** How far the download has come, 0 to 1, or null when none is under way. */
  readonly progress: Signal<number | null> = this.ring.asReadonly();
  readonly readyLine: Signal<string | null> = computed(() => {
    const { path, hasFallenBack, isLoaded } = this.state();
    if (!isLoaded || !path) return null;
    return hasFallenBack ? this.spec.fellBackReady : this.spec.paths[path].ready;
  });

  constructor(
    readonly spec: ModelSpec,
    private readonly owner: ModelOwner,
    private readonly services: LoaderServices,
  ) {}

  isLoading(): boolean {
    return this.loading !== null;
  }

  isLoaded(): boolean {
    return this.state().isLoaded;
  }

  hasFallenBack(): boolean {
    return this.state().hasFallenBack;
  }

  /** Where it runs, or will: the processor until a path is chosen. */
  currentPath(): ModelPath {
    return this.spec.paths[this.state().path ?? 'cpu'];
  }

  /** Settles once the load under way does; at once when none is. */
  whenLoaded(): Promise<void> {
    return this.loading ?? Promise.resolve();
  }

  /** Starts the load unless one is under way. Rejects if it fails, once
   *  the owner has been told. */
  load(): Promise<void> {
    this.loading ??= this.runLoad(++this.attempt);
    return this.loading;
  }

  /** Frees the model, stopping its download if it is still coming; the
   *  browser's cache keeps the weights for next time. */
  unload(): void {
    if (!this.loading) return;
    this.stopCounting();
    // An unload that fails has nothing left to free.
    this.services.client.unload(this.spec.model).catch(() => undefined);
    if (!this.services.status.isTroubleShown()) this.services.status.clear();
  }

  /** Forgets a failed load, so the next one starts afresh on the card. */
  forget(): void {
    this.stopCounting();
    this.state.set(FRESH);
  }

  /** Whether the weights are in the browser already. */
  async isCached(): Promise<boolean> {
    const key = await this.choosePath();
    return this.services.client
      .isCached(this.spec.model, this.spec.paths[key].dtype)
      .catch(() => false);
  }

  /** The loaded model is gone. When the graphics card was to blame it loads
   *  again on the processor; otherwise where it was. Only if still wanted:
   *  a model nobody wants waits until it is next asked for. */
  lose(toProcessor: boolean): void {
    if (!this.isLoaded()) return;
    this.stopCounting();
    const movesToProcessor = toProcessor && this.state().path !== 'cpu';
    if (movesToProcessor) this.moveToProcessor();
    if (!this.owner.isWanted()) return;
    this.services.narration.sayBriefly(
      movesToProcessor
        ? `The graphics card stopped running the ${this.spec.what}, so Home is loading the processor’s version (about ${this.spec.paths.cpu.mb} MB) instead.`
        : `The ${this.spec.what} stopped, so Home is loading it again.`,
    );
    // A failure reaches the owner through `failed`.
    this.load().catch(() => undefined);
  }

  private async runLoad(attempt: number): Promise<void> {
    try {
      await this.loadWithFallback(await this.choosePath());
      if (attempt === this.attempt) this.markLoaded();
    } catch (error: unknown) {
      // Unloaded while it came: whoever unloaded it has said so already.
      if (attempt === this.attempt) this.markFailed(error);
      throw error;
    } finally {
      this.ring.set(null);
    }
  }

  private async loadWithFallback(key: PathKey): Promise<void> {
    try {
      await this.loadOn(key);
    } catch (error: unknown) {
      const kind = kindOf(error);
      if (kind === 'download' || kind === 'cancelled' || key === 'cpu') throw error;
      this.moveToProcessor();
      const words = fallbackWords(this.spec.what, this.spec.paths.cpu.mb);
      this.services.status.show(words);
      this.services.narration.echo(words);
      await this.loadOn('cpu');
    }
  }

  private async loadOn(key: PathKey): Promise<void> {
    const { client, status } = this.services;
    const path = this.spec.paths[key];
    const words: LoadWordsInput = {
      what: this.spec.what,
      expectedMb: path.mb,
      isCached: await client.isCached(this.spec.model, path.dtype),
    };
    const label = capitalized(this.spec.what);
    const report = (loaded: number, total: number): void => {
      const fraction = loadedFraction(path.mb, loaded, total);
      this.ring.set(fraction);
      if (!status.isTroubleShown()) {
        status.showProgress(loadingWords(words, loaded, total), { fraction, label });
      }
    };
    report(0, 0);
    await client.load(this.spec.model, path, report);
  }

  private markLoaded(): void {
    this.state.update((state) => ({ ...state, isLoaded: true }));
    const { status, narration } = this.services;
    if (!status.isTroubleShown()) status.clear();
    const what = capitalized(this.spec.what);
    narration.echo(
      this.state().path === 'cpu' ? `${what} ready, on the processor` : `${what} ready`,
    );
  }

  private markFailed(error: unknown): void {
    this.loading = null;
    this.owner.failed(
      error instanceof VoiceError ? error : new VoiceError(messageOf(error), kindOf(error)),
    );
  }

  private async choosePath(): Promise<PathKey> {
    const chosen = this.state().path ?? (await this.services.probe());
    this.state.update((state) => ({ ...state, path: state.path ?? chosen }));
    return this.state().path ?? chosen;
  }

  private moveToProcessor(): void {
    this.state.update((state) => ({ ...state, path: 'cpu', hasFallenBack: true }));
  }

  private stopCounting(): void {
    this.attempt++;
    this.loading = null;
    this.state.update((state) => ({ ...state, isLoaded: false }));
  }
}
