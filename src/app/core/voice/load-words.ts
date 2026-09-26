const BYTES_PER_MB = 1e6;
/** The total grows as each file starts, so the size measured in the spike
 *  stands in until the real total nearly reaches it. */
const NEARLY_ALL = 0.9;
const CARD_READY = 'ready · graphics card';

export interface LoadWordsInput {
  /** "speech model" or "voice model". */
  readonly what: string;
  readonly expectedMb: number;
  readonly isCached: boolean;
}

/** The status line while a model loads, at `loaded` of `total` bytes. */
export function loadingWords(input: LoadWordsInput, loaded: number, total: number): string {
  const expected = input.expectedMb * BYTES_PER_MB;
  if (total >= expected * NEARLY_ALL && loaded >= total) return `Getting the ${input.what} ready`;
  if (input.isCached) return `Loading the ${input.what}`;
  const of = Math.max(expected, total);
  return `Downloading the ${input.what} · ${megabytes(loaded)} of ${megabytes(of)} MB · first time only`;
}

/** How far a load has come, 0 to 1, against the larger of the two sizes. */
export function loadedFraction(expectedMb: number, loaded: number, total: number): number {
  return Math.min(1, loaded / Math.max(expectedMb * BYTES_PER_MB, total));
}

export function fallbackWords(what: string, processorMb: number): string {
  return `The graphics card couldn’t run the ${what}, so Home is loading the processor’s version (about ${processorMb} MB) instead.`;
}

/** What the status line says when nothing else needs saying: each ready
 *  model's line, or one line when both are ready on the card. */
export function restingLine(readyLines: readonly string[]): string {
  if (readyLines.length < 2) return readyLines.join('');
  if (readyLines.every((line) => line.endsWith(CARD_READY))) {
    return `Speech and voice models ${CARD_READY}`;
  }
  return readyLines.map((line) => line.replace(/\.?$/, '.')).join(' ');
}

export function capitalized(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function megabytes(bytes: number): number {
  return Math.round(bytes / BYTES_PER_MB);
}
