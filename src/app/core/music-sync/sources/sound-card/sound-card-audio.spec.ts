import { PCM_PLAYER } from './pcm-player-worklet';
import {
  SOUND_CARD_STREAM_URL,
  SoundCardUnavailableError,
  openSoundCard,
} from './sound-card-audio';

/** Stand-ins for the Web Audio objects jsdom lacks, recording what the tap asks of them. */
class FakeAnalyser {
  fftSize = 0;
  smoothingTimeConstant = 0;
  readonly frequencyBinCount = 1024;
  getByteFrequencyData(into: Uint8Array): void {
    into.fill(9);
  }
}

class FakeContext {
  static last: FakeContext | null = null;
  readonly sampleRate: number;
  readonly analyser = new FakeAnalyser();
  readonly audioWorklet = { addModule: vi.fn(async (url: string) => void url) };
  readonly close = vi.fn(async () => undefined);
  constructor(options: AudioContextOptions) {
    this.sampleRate = options.sampleRate ?? 0;
    FakeContext.last = this;
  }
  createAnalyser(): FakeAnalyser {
    return this.analyser;
  }
}

class FakePlayer {
  static last: FakePlayer | null = null;
  readonly posted: number[][] = [];
  readonly port = { postMessage: (samples: Float32Array) => this.posted.push([...samples]) };
  readonly connected: unknown[] = [];
  constructor(
    readonly context: FakeContext,
    readonly name: string,
    readonly options: AudioWorkletNodeOptions,
  ) {
    FakePlayer.last = this;
  }
  connect(node: unknown): void {
    this.connected.push(node);
  }
}

function bytesOf(...values: number[]): Uint8Array<ArrayBuffer> {
  const view = new DataView(new ArrayBuffer(values.length * 4));
  values.forEach((value, index) => view.setFloat32(index * 4, value, true));
  return new Uint8Array(view.buffer);
}

/** A stream the test feeds, answered with the format headers the server sends. */
function streamedAnswer(
  headers: Record<string, string> = { 'x-sample-rate': '48000', 'x-channels': '2' },
) {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const body = new ReadableStream<Uint8Array>({ start: (given) => void (controller = given) });
  const asked: { url: string; init: RequestInit }[] = [];
  const fetchStream = async (url: string, init: RequestInit): Promise<Response> => {
    asked.push({ url, init });
    return new Response(body, { headers });
  };
  const feed = (chunk: Uint8Array): void => controller?.enqueue(chunk);
  const end = (): void => controller?.close();
  return { fetchStream, asked, feed, end };
}

const settle = (): Promise<void> => new Promise((done) => setTimeout(done));

describe('openSoundCard', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('AudioWorkletNode', FakePlayer);
    URL.createObjectURL = vi.fn(() => 'blob:pcm-player');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('asks the local API for the stream with the header only Observatory’s page can add', async () => {
    const answer = streamedAnswer();

    await openSoundCard(answer.fetchStream);

    expect(answer.asked[0]?.url).toBe(SOUND_CARD_STREAM_URL);
    expect(new Headers(answer.asked[0]?.init.headers).get('x-observatory')).toBe('1');
  });

  it('plays the stream through the worklet player into the analyser, at the stream’s own rate', async () => {
    const tap = await openSoundCard(streamedAnswer().fetchStream);
    const context = FakeContext.last;
    const player = FakePlayer.last;

    expect(context?.sampleRate).toBe(48_000);
    expect(context?.audioWorklet.addModule).toHaveBeenCalledWith('blob:pcm-player');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pcm-player');
    expect(player?.name).toBe(PCM_PLAYER);
    expect(player?.options.outputChannelCount).toEqual([2]);
    expect(player?.connected).toEqual([context?.analyser]);
    expect(tap.sound?.source).toBe(player);
    expect(tap.binHz).toBeCloseTo(48_000 / 2048);
  });

  it('posts each whole frame to the player as it arrives', async () => {
    const answer = streamedAnswer();
    await openSoundCard(answer.fetchStream);
    const bytes = bytesOf(0.5, -0.5, 0.25, -0.25);

    answer.feed(bytes.subarray(0, 10));
    answer.feed(bytes.subarray(10));
    await settle();

    expect(FakePlayer.last?.posted).toEqual([
      [0.5, -0.5],
      [0.25, -0.25],
    ]);
  });

  it('tells the listener when the stream ends from the server’s side, and lets go', async () => {
    const answer = streamedAnswer();
    const tap = await openSoundCard(answer.fetchStream);
    const ended = vi.fn();
    tap.onEnded(ended);

    answer.end();
    await settle();

    expect(ended).toHaveBeenCalledTimes(1);
    expect(FakeContext.last?.close).toHaveBeenCalled();
  });

  it('stops the stream on close without calling it an end', async () => {
    const answer = streamedAnswer();
    const tap = await openSoundCard(answer.fetchStream);
    const ended = vi.fn();
    tap.onEnded(ended);

    tap.close();
    await settle();

    expect(answer.asked[0]?.init.signal?.aborted).toBe(true);
    expect(ended).not.toHaveBeenCalled();
  });

  it('refuses when the local API cannot hear the sound card, or is not there', async () => {
    for (const status of [404, 503]) {
      const fetchStream = async (): Promise<Response> => new Response('{}', { status });

      await expect(openSoundCard(fetchStream)).rejects.toBeInstanceOf(SoundCardUnavailableError);
    }
  });

  it('refuses a stream whose format it cannot play', async () => {
    const answer = streamedAnswer({ 'x-sample-rate': 'fast', 'x-channels': '2' });

    await expect(openSoundCard(answer.fetchStream)).rejects.toBeInstanceOf(
      SoundCardUnavailableError,
    );
  });
});
