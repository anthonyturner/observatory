import { StreamFetch } from '../../../runs/runs-api';
import { AudioTap, NoAudioError, analyserTap } from '../audio-tap';
import { splitFrames } from './pcm-frames';
import { PCM_PLAYER, PcmPlayerOptions, pcmPlayerModuleUrl } from './pcm-player-worklet';

/** The local API's stream of whatever this computer plays. */
export const SOUND_CARD_STREAM_URL = '/api/sound-card/stream';

/** The local API could not hear this computer's sound card, or is not there to ask:
 *  Sync shows it as no audio, in the sound card's own words. */
export class SoundCardUnavailableError extends NoAudioError {
  constructor(detail: string) {
    super();
    this.message = `The sound card cannot be heard: ${detail}`;
  }
}

/** About 21 ms at 48 kHz: chunks come every 10 ms, and this rides out one up to 20 ms late. */
const START_FRAMES = 1024;
/** About 100 ms: more than this queued means the page fell behind, so it skips ahead. */
const MAX_FRAMES = 4800;
/** Once a second, any backlog the last second never dipped into is skipped. */
const TRIM_EVERY_FRAMES = 48_000;
const MAX_CHANNELS = 8;
const MIN_SAMPLE_RATE = 8_000;
const MAX_SAMPLE_RATE = 192_000;

interface StreamFormat {
  readonly sampleRate: number;
  readonly channels: number;
}

/** The stream's format from its headers, refused when it is not one Web Audio can play. */
function formatOf(headers: Headers): StreamFormat {
  const sampleRate = Number(headers.get('x-sample-rate'));
  const channels = Number(headers.get('x-channels'));
  const isRateValid =
    Number.isInteger(sampleRate) && sampleRate >= MIN_SAMPLE_RATE && sampleRate <= MAX_SAMPLE_RATE;
  const isChannelsValid = Number.isInteger(channels) && channels >= 1 && channels <= MAX_CHANNELS;
  if (!isRateValid || !isChannelsValid) throw new SoundCardUnavailableError('unknown format');
  return { sampleRate, channels };
}

interface OpenStream {
  readonly body: ReadableStream<Uint8Array>;
  readonly format: StreamFormat;
}

async function openStream(fetchStream: StreamFetch, signal: AbortSignal): Promise<OpenStream> {
  const response = await fetchStream(SOUND_CARD_STREAM_URL, {
    headers: { 'x-observatory': '1' },
    credentials: 'same-origin',
    signal,
  });
  if (!response.ok || !response.body)
    throw new SoundCardUnavailableError(`HTTP ${response.status}`);
  return { body: response.body, format: formatOf(response.headers) };
}

/** The PCM player in `context`, loaded from its own module. */
async function playerIn(context: AudioContext, channels: number): Promise<AudioWorkletNode> {
  const url = pcmPlayerModuleUrl();
  try {
    await context.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const processorOptions: PcmPlayerOptions = {
    channels,
    startFrames: START_FRAMES,
    maxFrames: MAX_FRAMES,
    trimEveryFrames: TRIM_EVERY_FRAMES,
  };
  return new AudioWorkletNode(context, PCM_PLAYER, {
    numberOfInputs: 0,
    outputChannelCount: [channels],
    processorOptions,
  });
}

/** Posts each whole frame of `body` to `player` until the stream ends or is cancelled. */
async function pump(
  body: ReadableStream<Uint8Array>,
  player: AudioWorkletNode,
  channels: number,
): Promise<void> {
  const reader = body.getReader();
  let rest = new Uint8Array(0);
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    const split = splitFrames(rest, chunk.value, channels);
    rest = split.rest;
    if (split.samples.length) player.port.postMessage(split.samples, [split.samples.buffer]);
  }
}

/**
 * This computer's sound, streamed by the local API, played into a real Web
 * Audio node for the analyser and Milkdrop to hear. It reaches no speakers:
 * the computer is already playing it.
 */
export async function openSoundCard(fetchStream: StreamFetch): Promise<AudioTap> {
  const abort = new AbortController();
  const { body, format } = await openStream(fetchStream, abort.signal);
  const context = new AudioContext({ sampleRate: format.sampleRate, latencyHint: 'interactive' });
  let isClosed = false;
  const close = (): void => {
    isClosed = true;
    abort.abort();
    void context.close();
  };
  let player: AudioWorkletNode;
  try {
    player = await playerIn(context, format.channels);
  } catch (error) {
    close();
    throw error;
  }
  const endedCallbacks: (() => void)[] = [];
  const ended = (): void => {
    if (isClosed) return;
    close();
    endedCallbacks.splice(0).forEach((callback) => callback());
  };
  void pump(body, player, format.channels).then(ended, ended);
  return analyserTap({
    context,
    source: player,
    onEnded: (callback) => void endedCallbacks.push(callback),
    close,
  });
}
