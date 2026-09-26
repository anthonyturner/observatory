import { VoiceError } from '../voice-error';
import {
  KOKORO_FILE,
  PHONEMIZER_FILE,
  PinnedFile,
  TRANSFORMERS_URL,
  importAt,
} from './library-urls';
import { KokoroConstructor, kokoroConstructorOf } from './transformers-api';

/* kokoro-js is taken as source rather than imported by address. Its module
   imports transformers and phonemizer by bare name, which a worker cannot
   resolve; its web bundle and jsDelivr's +esm build both bring transformers 3
   instead, a second runtime with its own 22 MB of WebAssembly, and fetch the
   weights from whatever Hugging Face's main branch holds. So the worker
   fetches the pinned file, checks it is byte for byte the file expected,
   points those imports at the transformers above and a pinned phonemizer, and
   its voice file at the model's pinned commit. Both models then share one
   runtime and one graphics-card device.

   Each rewrite matches kokoro.js's exact text, which is why any other file is
   refused by its hash rather than half rewritten. */
function rewrites(revision: string, phonemizerUrl: string): readonly (readonly [string, string])[] {
  return [
    ['from"@huggingface/transformers"', `from"${TRANSFORMERS_URL}"`],
    ['from"phonemizer"', `from"${phonemizerUrl}"`],
    ['import s from"path";', 'const s=null;'],
    ['import i from"fs/promises";', 'const i=null;'],
    ['/resolve/main/voices/', `/resolve/${revision}/voices/`],
  ];
}

let pending: Promise<KokoroConstructor> | null = null;

/** kokoro-js's KokoroTTS, on the transformers the worker already loaded. */
export function kokoroVoiceClass(revision: string): Promise<KokoroConstructor> {
  pending ??= loadKokoro(revision).catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}

async function loadKokoro(revision: string): Promise<KokoroConstructor> {
  const [source, phonemizer] = await Promise.all([checked(KOKORO_FILE), checked(PHONEMIZER_FILE)]);
  const phonemizerUrl = moduleUrl(phonemizer);
  const rewritten = rewrites(revision, phonemizerUrl).reduce(
    (text, [from, to]) => text.replace(from, to),
    source,
  );
  const url = moduleUrl(rewritten);
  try {
    const made = kokoroConstructorOf(await importAt(url));
    if (!made) throw new VoiceError('kokoro.js has no KokoroTTS', 'download');
    return made;
  } finally {
    URL.revokeObjectURL(url);
    URL.revokeObjectURL(phonemizerUrl);
  }
}

/** The text of a pinned file, refused unless it hashes to its `sha256`. */
async function checked({ url, sha256 }: PinnedFile): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new VoiceError(`${url} answered ${response.status}`, 'download');
  const bytes = await response.arrayBuffer();
  if ((await base64Sha256(bytes)) !== sha256) {
    throw new VoiceError(`${url} is not the file expected`, 'download');
  }
  return new TextDecoder().decode(bytes);
}

async function base64Sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return btoa(String.fromCharCode(...digest));
}

function moduleUrl(source: string): string {
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}
