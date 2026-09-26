import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { DEVICE_PROBE } from './device-probe';
import { ModelLoaders } from './model-loaders';
import { LISTEN_SPEC } from './model-specs';
import { VoiceError } from './voice-error';
import { DevicePath, VoiceModelId } from './voice-protocol';
import { ModelLoss, VoiceWorkerClient } from './voice-worker-client';

class FakeClient {
  readonly losses = new Subject<ModelLoss>();
  readonly loads: string[] = [];
  failOn: Record<string, VoiceError> = {};
  isCached = async () => true;
  unload = async () => undefined;

  async load(_model: VoiceModelId, path: DevicePath): Promise<void> {
    this.loads.push(path.device);
    const failure = this.failOn[path.device];
    if (failure) throw failure;
  }
}

function setup() {
  const client = new FakeClient();
  const failures: VoiceError[] = [];
  TestBed.configureTestingModule({
    providers: [
      { provide: VoiceWorkerClient, useValue: client },
      { provide: DEVICE_PROBE, useValue: async () => 'gpu' },
    ],
  });
  const loaders = TestBed.inject(ModelLoaders);
  const loader = loaders.create(LISTEN_SPEC, {
    isWanted: () => true,
    failed: (error) => failures.push(error),
  });
  return { client, loader, loaders, failures };
}

describe('ModelLoader', () => {
  it('loads on the graphics card once, and says so', async () => {
    const { client, loader, loaders } = setup();
    await Promise.all([loader.load(), loader.load()]);
    expect(client.loads).toEqual(['webgpu']);
    expect(loader.isLoaded()).toBe(true);
    expect(loaders.restingLine()).toBe('Speech model ready · graphics card');
  });

  it('falls back to the processor when the card fails it', async () => {
    const { client, loader, loaders } = setup();
    client.failOn['webgpu'] = new VoiceError('no shaders', 'device');
    await loader.load();
    expect(client.loads).toEqual(['webgpu', 'wasm']);
    expect(loader.hasFallenBack()).toBe(true);
    expect(loaders.restingLine()).toBe(LISTEN_SPEC.fellBackReady);
  });

  it('tells its owner of a failed download, without falling back', async () => {
    const { client, loader, failures } = setup();
    client.failOn['webgpu'] = new VoiceError('offline', 'download');
    await expect(loader.load()).rejects.toThrow('offline');
    expect(client.loads).toEqual(['webgpu']);
    expect(failures.map((failure) => failure.kind)).toEqual(['download']);
    expect(loader.isLoading()).toBe(false);
  });

  it('loads again on the processor when the card drops it', async () => {
    const { client, loader } = setup();
    await loader.load();
    client.losses.next({ model: 'listen', toProcessor: true });
    await loader.whenLoaded();
    expect(client.loads).toEqual(['webgpu', 'wasm']);
    expect(loader.isLoaded()).toBe(true);
  });
});
