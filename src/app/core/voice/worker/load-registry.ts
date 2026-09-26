import { VoiceModelId } from '../voice-protocol';

/** Each model's load in flight, so unloading it can stop its download, and
 *  whether a fetch failed during one, so a failure can be told apart: the
 *  network (try again) or the device (fall back to the processor). */
export class LoadRegistry {
  private readonly loads = new Map<VoiceModelId, AbortController>();
  private fetchFailed = false;

  /** `ids` are the models' Hugging Face ids, which every weight address holds. */
  constructor(private readonly ids: Readonly<Record<VoiceModelId, string>>) {}

  begin(model: VoiceModelId): AbortSignal {
    this.fetchFailed = false;
    const load = new AbortController();
    this.loads.set(model, load);
    return load.signal;
  }

  end(model: VoiceModelId, signal: AbortSignal): void {
    if (this.loads.get(model)?.signal === signal) this.loads.delete(model);
  }

  abort(model: VoiceModelId): void {
    this.loads.get(model)?.abort();
  }

  /** The signal of the load a request at `url` belongs to, if any. */
  signalFor(url: string): AbortSignal | undefined {
    for (const [model, load] of this.loads) {
      if (url.includes(`/${this.ids[model]}/`)) return load.signal;
    }
    return undefined;
  }

  noteFetchFailure(): void {
    this.fetchFailed = true;
  }

  hasFetchFailed(): boolean {
    return this.fetchFailed;
  }
}
