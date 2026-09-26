import { VoiceError } from '../voice-error';
import { LoadRegistry } from './load-registry';
import { TRANSFORMERS_URL, importAt } from './library-urls';
import { Transformers, isTransformers } from './transformers-api';

/** A missing file is transformers.js asking whether an optional one exists. */
const NOT_FOUND = 404;

/** transformers.js, imported once, fetching through the load registry so a
 *  model's download can be stopped and a network failure noticed. */
export class TransformersLibrary {
  private pending: Promise<Transformers> | null = null;

  constructor(private readonly loads: LoadRegistry) {}

  get(): Promise<Transformers> {
    this.pending ??= this.importLibrary().catch((error: unknown) => {
      this.pending = null;
      this.loads.noteFetchFailure();
      throw error;
    });
    return this.pending;
  }

  private async importLibrary(): Promise<Transformers> {
    const lib = await importAt(TRANSFORMERS_URL);
    if (!isTransformers(lib)) {
      throw new VoiceError('transformers.js is not as expected', 'download');
    }
    lib.env.allowLocalModels = false;
    lib.env.fetch = (url, init) => this.fetch(url, init);
    return lib;
  }

  private async fetch(url: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const signal = this.loads.signalFor(url instanceof Request ? url.url : String(url));
    try {
      const response = await fetch(url, signal ? { ...init, signal } : init);
      if (!response.ok && response.status !== NOT_FOUND) this.loads.noteFetchFailure();
      return response;
    } catch (error: unknown) {
      this.loads.noteFetchFailure();
      throw error;
    }
  }
}
