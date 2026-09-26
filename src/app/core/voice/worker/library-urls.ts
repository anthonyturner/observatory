/** transformers.min.js rather than jsDelivr's +esm build: the +esm build
 *  imports onnxruntime-common with no version, while this file carries its
 *  runtime inside and fetches the WebAssembly from an exact onnxruntime-web
 *  version. Import maps do not apply inside a worker, so it goes by address. */
export const TRANSFORMERS_URL =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js';

/** A pinned file and jsDelivr's SHA-256 of it, in base64. */
export interface PinnedFile {
  readonly url: string;
  readonly sha256: string;
}

export const KOKORO_FILE: PinnedFile = {
  url: 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.js',
  sha256: 'MbHbKqSnQR9VeGkA8MvdA1HxBjhZsQf5qZaZoDsJi30=',
};

export const PHONEMIZER_FILE: PinnedFile = {
  url: 'https://cdn.jsdelivr.net/npm/phonemizer@1.2.1/dist/phonemizer.js',
  sha256: 'GTSB9HT3weqB3zGV0YtF3473JU29zLPxk9YCFcSJe+w=',
};

/** A module at a run-time address. The bundler must leave it alone: it
 *  would otherwise try to resolve and bundle the address itself. */
export function importAt(url: string): Promise<unknown> {
  return import(/* @vite-ignore */ url);
}
