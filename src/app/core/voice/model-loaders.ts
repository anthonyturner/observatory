import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DEVICE_PROBE } from './device-probe';
import { restingLine } from './load-words';
import { ModelLoader, ModelOwner } from './model-loader';
import { ModelSpec } from './model-specs';
import { VoiceNarration } from './voice-narration';
import { VoiceControlId, VoiceStatus } from './voice-status';
import { VoiceWorkerClient } from './voice-worker-client';

/** Makes each model's loader, and speaks for them all: which are ready,
 *  and which is loading behind which button. */
@Injectable({ providedIn: 'root' })
export class ModelLoaders {
  private readonly client = inject(VoiceWorkerClient);
  private readonly probe = inject(DEVICE_PROBE);
  private readonly status = inject(VoiceStatus);
  private readonly narration = inject(VoiceNarration);
  private readonly loaders = signal<readonly ModelLoader[]>([]);

  /** The status line when nothing else needs saying. */
  readonly restingLine: Signal<string> = computed(() =>
    restingLine(
      this.loaders()
        .map((loader) => loader.readyLine())
        .filter((line) => line !== null),
    ),
  );

  constructor() {
    this.client.losses.pipe(takeUntilDestroyed()).subscribe(({ model, toProcessor }) => {
      this.loaders()
        .filter((loader) => loader.spec.model === model)
        .forEach((loader) => loader.lose(toProcessor));
    });
  }

  create(spec: ModelSpec, owner: ModelOwner): ModelLoader {
    const { client, probe, status, narration } = this;
    const loader = new ModelLoader(spec, owner, { client, probe, status, narration });
    this.loaders.update((loaders) => [...loaders, loader]);
    return loader;
  }

  /** The download progress of the model behind `control`, for its ring. */
  progressOf(control: VoiceControlId): Signal<number | null> {
    return computed(
      () =>
        this.loaders()
          .filter((loader) => loader.spec.control === control)
          .map((loader) => loader.progress())
          .find((progress) => progress !== null) ?? null,
    );
  }
}
