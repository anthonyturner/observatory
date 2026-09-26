import { keyScrubber } from '../assistant/key-scrub.ts';
import { isTimeout, pause } from '../util/outbound.ts';
import { complaintOf } from './eleven-labs-complaint.ts';
import { ElevenLabsError, voiceReasonOf } from './eleven-labs-error.ts';

/** One voice on the ElevenLabs account. */
export interface Voice {
  readonly id: string;
  readonly name: string;
}

/** One sentence to say, in one voice; checked where it is received. */
export interface SpeakRequest {
  readonly text: string;
  readonly voice: string;
}

/** The spoken audio, as ElevenLabs sent it. */
export interface Speech {
  readonly audio: ArrayBuffer;
  readonly contentType: string;
}

/** The ElevenLabs account one key pays for. */
export interface ElevenLabs {
  /** False with no key: every call then fails with the reason `key`, sending nothing. */
  readonly isOn: boolean;
  /** The account's voices, by name. */
  voices(): Promise<Voice[]>;
  speak(request: SpeakRequest): Promise<Speech>;
}

export interface ElevenLabsOptions {
  /** A paid credential: it goes into the `xi-api-key` header and nowhere else. */
  readonly key: string | null;
  readonly fetch?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
}

interface Call {
  readonly path: string;
  readonly accept: string;
  readonly timeoutMs: number;
  /** Sent as JSON in a POST; a call without one is a GET. */
  readonly body?: unknown;
}

const ELEVENLABS = {
  base: 'https://api.elevenlabs.io/v1',
  voices: { path: '/voices', timeoutMs: 8000 },
  speech: {
    path: '/text-to-speech/',
    model: 'eleven_flash_v2_5',
    format: 'mp3_44100_128',
    contentType: 'audio/mpeg',
    timeoutMs: 15000,
  },
};

const JSON_TYPE = 'application/json';
/** A rate limit is worth one more try, soon, since someone is waiting to hear the reply. */
const HTTP_TOO_MANY_REQUESTS = 429;
const RETRY_MS = 600;
const MAX_WAIT_MS = 1500;
const MS_PER_SECOND = 1000;
const MAX_DETAIL_LENGTH = 160;

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

/** The wait before the retry: ElevenLabs's own `retry-after` when it gives one, capped. */
function waitBefore(response: Response): number {
  const after = Number(response.headers.get('retry-after'));
  return Math.min(after > 0 ? after * MS_PER_SECOND : RETRY_MS, MAX_WAIT_MS);
}

/** A successful answer's body; the time limit covers it too, and can run out part way. */
async function bodyOf<T>(response: Response, read: (response: Response) => Promise<T>) {
  try {
    return await read(response);
  } catch (error) {
    throw new ElevenLabsError(isTimeout(error) ? 'timeout' : 'shape', response.status);
  }
}

const isVoice = (each: Readonly<Record<string, unknown>>): boolean =>
  typeof each['voice_id'] === 'string' && typeof each['name'] === 'string';

function voicesOf(body: unknown): Voice[] {
  const listed = isObject(body) ? body['voices'] : undefined;
  if (!Array.isArray(listed)) throw new ElevenLabsError('shape', null, 'no voices');
  return listed
    .filter(isObject)
    .filter(isVoice)
    .map((each) => ({ id: String(each['voice_id']), name: String(each['name']) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const speechPath = (voice: string): string =>
  `${ELEVENLABS.speech.path}${encodeURIComponent(voice)}?output_format=${ELEVENLABS.speech.format}`;

/**
 * The one door to ElevenLabs: the account's voices, and speech in one of them.
 * With no key it still builds, `isOn` is false and every call fails with the
 * reason `key`, so a site without one starts and says so.
 */
export function elevenLabs(options: ElevenLabsOptions): ElevenLabs {
  const { key, fetch: send = fetch, sleep = pause } = options;
  const scrub = keyScrubber(key);

  /** One line of ElevenLabs's own complaint, for the server's log. */
  const detailOf = (message: string): string =>
    scrub(message).split('\n')[0].slice(0, MAX_DETAIL_LENGTH);

  async function sendOnce(call: Call, apiKey: string): Promise<Response> {
    const headers: Record<string, string> = { 'xi-api-key': apiKey, accept: call.accept };
    if (call.body !== undefined) headers['content-type'] = JSON_TYPE;
    try {
      return await send(ELEVENLABS.base + call.path, {
        method: call.body === undefined ? 'GET' : 'POST',
        headers,
        body: call.body === undefined ? undefined : JSON.stringify(call.body),
        signal: AbortSignal.timeout(call.timeoutMs),
      });
    } catch (error) {
      if (isTimeout(error)) throw new ElevenLabsError('timeout', null);
      const said = error instanceof Error ? error.message : String(error);
      throw new ElevenLabsError('network', null, detailOf(said));
    }
  }

  async function failure(response: Response): Promise<ElevenLabsError> {
    const complaint = complaintOf(await response.text().catch(() => ''));
    const reason = voiceReasonOf(response.status, complaint);
    return new ElevenLabsError(reason, response.status, detailOf(complaint.message));
  }

  /** A successful answer to `call`, trying a rate limit once more. */
  async function request(call: Call): Promise<Response> {
    if (!key) throw new ElevenLabsError('key', null, 'no key set');
    let response = await sendOnce(call, key);
    if (response.status === HTTP_TOO_MANY_REQUESTS) {
      await response.body?.cancel();
      await sleep(waitBefore(response));
      response = await sendOnce(call, key);
    }
    if (response.ok) return response;
    throw await failure(response);
  }

  async function voices(): Promise<Voice[]> {
    const response = await request({ ...ELEVENLABS.voices, accept: JSON_TYPE });
    return voicesOf(await bodyOf(response, (answered) => answered.json()));
  }

  async function speak({ text, voice }: SpeakRequest): Promise<Speech> {
    const { speech } = ELEVENLABS;
    const response = await request({
      path: speechPath(voice),
      accept: speech.contentType,
      timeoutMs: speech.timeoutMs,
      body: { text, model_id: speech.model },
    });
    const audio = await bodyOf(response, (answered) => answered.arrayBuffer());
    return { audio, contentType: response.headers.get('content-type') || speech.contentType };
  }

  return { isOn: Boolean(key), voices, speak };
}
