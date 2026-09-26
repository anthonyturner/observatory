import { VoiceError, messageOf } from '../voice-error';
import {
  CacheAnswer,
  DevicePath,
  RunRequest,
  SpokenClip,
  Transcript,
  VoiceModelId,
  WeightChoice,
} from '../voice-protocol';
import { loadFailureKind } from './load-failure';
import { LoadRegistry } from './load-registry';
import { ModelEntry, ReadyModel } from './model-entry';
import { ProgressReport, ProgressTally } from './progress-tally';
import { inLane } from './run-lane';
import { Transformers } from './transformers-api';
import { TransformersLibrary } from './transformers-library';

/** transformers.js's own name for the cache it keeps weights in. */
const WEIGHTS_CACHE = 'transformers-cache';

export interface WorkerOpsOptions {
  readonly models: Readonly<Record<VoiceModelId, ModelEntry>>;
  readonly loads: LoadRegistry;
  readonly library: TransformersLibrary;
  /** Told when the graphics card drops its device and a model with it. */
  readonly onLost: (model: VoiceModelId) => void;
}

/** What the voice worker does: load, unload, check the cache, and run. */
export class WorkerOps {
  private readonly ready = new Map<VoiceModelId, ReadyModel>();

  constructor(private readonly options: WorkerOpsOptions) {}

  async load(model: VoiceModelId, path: DevicePath, report: ProgressReport): Promise<void> {
    const { models, loads, library } = this.options;
    const tally = new ProgressTally(report);
    await this.drop(model);
    const signal = loads.begin(model);
    try {
      const lib = await library.get();
      const made = await models[model].load(lib, path, (progress) => tally.add(progress));
      if (signal.aborted) {
        await made.dispose();
        throw new VoiceError(`${model} was unloaded`, 'cancelled');
      }
      this.ready.set(model, made);
      if (path.device === 'webgpu') this.watchDevice(lib, model);
    } catch (error: unknown) {
      const outcome = { wasAborted: signal.aborted, hasFetchFailed: loads.hasFetchFailed() };
      throw new VoiceError(messageOf(error), loadFailureKind(error, outcome));
    } finally {
      loads.end(model, signal);
    }
  }

  /** Frees a model, stopping its download if it is still coming. */
  async unload(model: VoiceModelId): Promise<void> {
    this.options.loads.abort(model);
    await this.drop(model);
  }

  /** Whether a model's weights are in the browser's cache already, so the
   *  page asks before a first download only. */
  async cached(model: VoiceModelId, dtype: WeightChoice): Promise<CacheAnswer> {
    try {
      const cache = await caches.open(WEIGHTS_CACHE);
      const files = this.options.models[model].files(dtype);
      const hits = await Promise.all(files.map((url) => cache.match(url)));
      return { cached: hits.every(Boolean) };
    } catch {
      // No cache storage (a private window, say): every load is a download.
      return { cached: false };
    }
  }

  run(request: RunRequest): Promise<Transcript | SpokenClip> {
    return inLane(() => {
      const made = this.ready.get(request.model);
      if (!made) throw new VoiceError(`${request.model} is not loaded`, 'unloaded');
      return made.run(request);
    });
  }

  private async drop(model: VoiceModelId): Promise<void> {
    const was = this.ready.get(model);
    this.ready.delete(model);
    await was?.dispose();
  }

  /** A graphics card can drop its device (a driver reset, say). The model on
   *  it is gone then, so the page is told and loads it again. With no device
   *  to watch, a failed run says the same, later. */
  private watchDevice(lib: Transformers, model: VoiceModelId): void {
    const forget = (): void => {
      this.ready.delete(model);
      this.options.onLost(model);
    };
    Promise.resolve()
      .then(() => lib.env.backends?.onnx?.webgpu?.device)
      .then((device) => lostOf(device)?.then(forget))
      .catch(() => undefined);
  }
}

function lostOf(device: unknown): Promise<unknown> | null {
  if (typeof device !== 'object' || device === null || !('lost' in device)) return null;
  return device.lost instanceof Promise ? device.lost : null;
}
