import { json, type RouteTable } from '../http/api-handler.ts';
import type { PcmFormat } from './pcm-source.ts';
import type { SoundCardCapture } from './sound-card-capture.ts';

const STATUS_PATH = '/api/sound-card';
const STREAM_PATH = '/api/sound-card/stream';
const HTTP_UNAVAILABLE = 503;

export interface SoundCardRoutesOptions {
  readonly capture: SoundCardCapture;
  readonly format: PcmFormat;
  /** Whether this machine can capture its sound card at all. */
  readonly isAvailable: boolean;
  readonly warn?: (message: string) => void;
}

/** What `GET /api/sound-card` answers. */
export interface SoundCardStatus {
  readonly available: boolean;
}

/** The capture as a never-ending binary response, let go of when the page goes away. */
async function streamed(options: SoundCardRoutesOptions): Promise<Response> {
  const { capture, format, warn = console.warn } = options;
  let stop = (): void => undefined;
  let ready: Promise<void> = Promise.resolve();
  let isOpen = true;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const listening = capture.listen({
        data: (chunk) => {
          if (isOpen) controller.enqueue(chunk);
        },
        ended: () => {
          if (!isOpen) return;
          isOpen = false;
          controller.close();
        },
      });
      stop = () => listening.stop();
      ready = listening.ready;
    },
    cancel() {
      isOpen = false;
      stop();
    },
  });
  try {
    await ready;
  } catch (error) {
    stop();
    warn(`The sound card could not be captured: ${error instanceof Error ? error.message : error}`);
    return json(HTTP_UNAVAILABLE, { error: 'the sound card could not be captured' });
  }
  return new Response(body, {
    headers: {
      'content-type': 'application/octet-stream',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-sample-rate': String(format.sampleRate),
      'x-channels': String(format.channels),
    },
  });
}

/**
 * `table` with this machine's sound card, for Sync to hear whatever it plays:
 *
 *   GET /api/sound-card          { available }
 *   GET /api/sound-card/stream   32-bit float PCM as it plays, format in x-sample-rate
 *                                and x-channels; 503 when it cannot be captured.
 *                                Guarded like a write: each one starts a capture.
 *
 * Only the local server mounts these; the hosted site has no sound card to offer.
 */
export function withSoundCardRoutes(
  table: RouteTable,
  options: SoundCardRoutesOptions,
): RouteTable {
  const status: SoundCardStatus = { available: options.isAvailable };
  const unavailable = async (): Promise<Response> =>
    json(HTTP_UNAVAILABLE, { error: 'this machine cannot capture its sound card' });
  return {
    ...table,
    get: { ...table.get, [STATUS_PATH]: async () => status },
    guardedGet: {
      ...table.guardedGet,
      [STREAM_PATH]: () => (options.isAvailable ? streamed(options) : unavailable()),
    },
  };
}
