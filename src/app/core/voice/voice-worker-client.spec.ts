import { TestBed } from '@angular/core/testing';
import { VoiceError } from './voice-error';
import { ModelLoss, VOICE_WORKER, VoiceWorkerClient, VoiceWorkerPort } from './voice-worker-client';
import { LIMIT_MS } from './within';

class FakePort implements VoiceWorkerPort {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly sent: { id: number; request: { op: string } }[] = [];
  isTerminated = false;

  postMessage(message: { id: number; request: { op: string } }): void {
    this.sent.push(message);
  }

  terminate(): void {
    this.isTerminated = true;
  }

  answer(data: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  lastId(): number {
    return this.sent[this.sent.length - 1].id;
  }
}

function setup() {
  const ports: FakePort[] = [];
  TestBed.configureTestingModule({
    providers: [
      {
        provide: VOICE_WORKER,
        useValue: () => {
          const port = new FakePort();
          ports.push(port);
          return port;
        },
      },
    ],
  });
  const client = TestBed.inject(VoiceWorkerClient);
  const losses: ModelLoss[] = [];
  client.losses.subscribe((loss) => losses.push(loss));
  return { client, ports, losses };
}

const kindOf = (kind: string) => (error: unknown) =>
  error instanceof VoiceError && error.kind === kind;

describe('VoiceWorkerClient', () => {
  afterEach(() => vi.useRealTimers());

  it('starts the worker on first use only, and reads its answers', async () => {
    const { client, ports } = setup();
    expect(ports).toHaveLength(0);
    const cached = client.isCached('listen', 'q8');
    ports[0].answer({ op: 'done', id: ports[0].lastId(), result: { cached: true } });
    await expect(cached).resolves.toBe(true);

    const heard = client.transcribe(new Float32Array(4));
    ports[0].answer({ op: 'done', id: ports[0].lastId(), result: { text: 'hello' } });
    await expect(heard).resolves.toBe('hello');
    expect(ports).toHaveLength(1);
  });

  it('passes on load progress', async () => {
    const { client, ports } = setup();
    const progress: number[][] = [];
    const load = client.load('speak', { device: 'wasm', dtype: 'q8' }, (loaded, total) =>
      progress.push([loaded, total]),
    );
    const id = ports[0].lastId();
    ports[0].answer({ op: 'progress', id, loaded: 5, total: 10 });
    ports[0].answer({ op: 'done', id, result: {} });
    await load;
    expect(progress).toEqual([[5, 10]]);
  });

  it('fails a call with the kind the worker gives, and ignores malformed answers', async () => {
    const { client, ports } = setup();
    const load = client.load('listen', { device: 'webgpu', dtype: 'fp16' }, () => undefined);
    const id = ports[0].lastId();
    ports[0].answer({ op: 'failed', id, kind: 'nonsense', message: 'x' });
    ports[0].answer({ op: 'failed', id, kind: 'download', message: 'offline' });
    await expect(load).rejects.toSatisfy(kindOf('download'));
  });

  it('gives up on a run that never answers, and starts a fresh worker', async () => {
    vi.useFakeTimers();
    const { client, ports, losses } = setup();
    const heard = client.transcribe(new Float32Array(4));
    const failed = expect(heard).rejects.toSatisfy(kindOf('run'));
    await vi.advanceTimersByTimeAsync(LIMIT_MS.run);
    await failed;
    expect(ports[0].isTerminated).toBe(true);
    expect(losses).toEqual([
      { model: 'listen', toProcessor: true },
      { model: 'speak', toProcessor: false },
    ]);
    void client.isCached('speak', 'fp32').catch(() => undefined);
    expect(ports).toHaveLength(2);
  });

  it('reports a model lost when a run finds none, or the card drops it', async () => {
    const { client, ports, losses } = setup();
    const spoken = client.synthesize('Hello.');
    ports[0].answer({ op: 'failed', id: ports[0].lastId(), kind: 'unloaded', message: 'gone' });
    await expect(spoken).rejects.toSatisfy(kindOf('unloaded'));
    ports[0].answer({ op: 'lost', model: 'listen' });
    expect(losses).toEqual([
      { model: 'speak', toProcessor: true },
      { model: 'listen', toProcessor: true },
    ]);
  });

  it('fails every waiting call when the worker cannot start', async () => {
    const { client, ports } = setup();
    const cached = client.isCached('listen', 'q8');
    ports[0].onerror?.(new ErrorEvent('error'));
    await expect(cached).rejects.toSatisfy(kindOf('device'));
    expect(ports[0].isTerminated).toBe(true);
  });
});
