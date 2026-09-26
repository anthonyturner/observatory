import { DOCUMENT, DestroyRef, Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { readCached, readClip, readTranscript, isVoiceReply } from './reply-reader';
import { VoiceError, kindOf } from './voice-error';
import {
  DevicePath,
  RunRequest,
  SpokenClip,
  VoiceModelId,
  VoiceReply,
  VoiceRequest,
  WeightChoice,
} from './voice-protocol';
import { LIMIT_MS, within } from './within';

/** The part of a Worker the client uses, so a test can stand in for one. */
export interface VoiceWorkerPort {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
  terminate(): void;
}

/** Starts the voice worker. It is started on first use, never with the page. */
export const VOICE_WORKER = new InjectionToken<() => VoiceWorkerPort>('VoiceWorker', {
  providedIn: 'root',
  factory: () => () =>
    new Worker(new URL('./worker/voice.worker', import.meta.url), {
      type: 'module',
      name: 'voice',
    }),
});

/** A loaded model is gone. `toProcessor` when the graphics card was to blame,
 *  so it should load again on the processor, which does not depend on it. */
export interface ModelLoss {
  readonly model: VoiceModelId;
  readonly toProcessor: boolean;
}

export type LoadProgressReport = (loaded: number, total: number) => void;

interface PendingCall {
  readonly resolve: (result: unknown) => void;
  readonly reject: (error: VoiceError) => void;
  readonly onProgress?: LoadProgressReport;
}

const MODELS: readonly VoiceModelId[] = ['listen', 'speak'];

/** Talks to the voice worker: numbered calls, time limits on runs, and a
 *  fresh worker when one stops answering. */
@Injectable({ providedIn: 'root' })
export class VoiceWorkerClient {
  private readonly startWorker = inject(VOICE_WORKER);
  private readonly calls = new Map<number, PendingCall>();
  private readonly lost = new Subject<ModelLoss>();
  private worker: VoiceWorkerPort | null = null;
  private lastId = 0;

  /** Models the worker no longer holds, whichever way they went. */
  readonly losses: Observable<ModelLoss> = this.lost.asObservable();

  constructor() {
    const window = inject(DOCUMENT).defaultView;
    const leave = (event: PageTransitionEvent): void => {
      if (!event.persisted) this.worker?.terminate();
    };
    window?.addEventListener('pagehide', leave);
    inject(DestroyRef).onDestroy(() => {
      window?.removeEventListener('pagehide', leave);
      this.worker?.terminate();
    });
  }

  load(model: VoiceModelId, path: DevicePath, onProgress: LoadProgressReport): Promise<void> {
    const request: VoiceRequest = { op: 'load', model, ...path };
    return this.call(request, [], onProgress).then(() => undefined);
  }

  /** Frees a model, stopping its download if it is still coming. */
  unload(model: VoiceModelId): Promise<void> {
    return this.call({ op: 'unload', model }).then(() => undefined);
  }

  isCached(model: VoiceModelId, dtype: WeightChoice): Promise<boolean> {
    return this.call({ op: 'cached', model, dtype }).then(readCached);
  }

  /** The clip's words; `audio` is 16 kHz mono, and is moved to the worker. */
  transcribe(audio: Float32Array): Promise<string> {
    return this.run({ model: 'listen', audio }, [audio.buffer]).then(readTranscript);
  }

  synthesize(text: string): Promise<SpokenClip> {
    return this.run({ model: 'speak', text }, []).then(readClip);
  }

  /** Ends the worker and every call waiting on it. `culprit` is the model
   *  whose run hung, if one did: it moves to the processor, and any other
   *  model loads again where it was. */
  restart(culprit: VoiceModelId | null): void {
    const stopped = new VoiceError('The voice worker stopped', 'device');
    this.calls.forEach((call) => call.reject(stopped));
    this.calls.clear();
    this.worker?.terminate();
    this.worker = null;
    MODELS.forEach((model) => this.lost.next({ model, toProcessor: model === culprit }));
  }

  private async run(request: RunRequest, transfer: Transferable[]): Promise<unknown> {
    try {
      return await within(this.call({ op: 'run', ...request }, transfer), LIMIT_MS.run, 'run');
    } catch (error: unknown) {
      this.noticeRunFailure(request.model, error);
      throw error;
    }
  }

  /** A run that never answered has most likely hung the worker, so a fresh
   *  one loads the model again. A model that went missing, or made no sound,
   *  is loaded again too. */
  private noticeRunFailure(model: VoiceModelId, error: unknown): void {
    const kind = kindOf(error);
    if (kind === 'run') this.restart(model);
    else if (kind === 'unloaded' || kind === 'silent') this.lost.next({ model, toProcessor: true });
  }

  private call(
    request: VoiceRequest,
    transfer: Transferable[] = [],
    onProgress?: LoadProgressReport,
  ): Promise<unknown> {
    const id = ++this.lastId;
    return new Promise((resolve, reject) => {
      this.calls.set(id, { resolve, reject, onProgress });
      this.running().postMessage({ id, request }, transfer);
    });
  }

  private running(): VoiceWorkerPort {
    if (this.worker) return this.worker;
    const worker = this.startWorker();
    worker.onmessage = (event) => this.receive(event.data);
    // A worker that cannot start at all takes its pending calls with it; the
    // next use starts a fresh one.
    worker.onerror = (event) => {
      event.preventDefault();
      this.restart(null);
    };
    this.worker = worker;
    return worker;
  }

  private receive(data: unknown): void {
    if (!isVoiceReply(data)) return;
    if (data.op === 'lost') {
      this.lost.next({ model: data.model, toProcessor: true });
      return;
    }
    const call = this.calls.get(data.id);
    if (call) this.settle(call, data);
  }

  private settle(call: PendingCall, reply: Exclude<VoiceReply, { op: 'lost' }>): void {
    if (reply.op === 'progress') {
      call.onProgress?.(reply.loaded, reply.total);
      return;
    }
    this.calls.delete(reply.id);
    if (reply.op === 'done') call.resolve(reply.result);
    else call.reject(new VoiceError(reply.message, reply.kind));
  }
}
