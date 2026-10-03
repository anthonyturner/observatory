import { BandLevels } from './music-sync.types';

/** Where each band sits, in hertz: the kick and bassline, the leads and pads, the
 *  hats, and the kick's own punch, below most of the bassline. */
const BANDS = {
  bass: { from: 30, to: 150 },
  mid: { from: 150, to: 2000 },
  high: { from: 4000, to: 12000 },
  kick: { from: 40, to: 100 },
} as const;

const MAX_BIN = 255;

/** How loud each band is in one analyser reading, where bin `i` covers `i * binHz` hertz. */
export function bandLevels(bins: Uint8Array, binHz: number): BandLevels {
  return {
    bass: averageOf(bins, binHz, BANDS.bass),
    mid: averageOf(bins, binHz, BANDS.mid),
    high: averageOf(bins, binHz, BANDS.high),
    kick: averageOf(bins, binHz, BANDS.kick),
  };
}

function averageOf(bins: Uint8Array, binHz: number, band: { from: number; to: number }): number {
  const first = Math.max(0, Math.floor(band.from / binHz));
  const last = Math.min(bins.length - 1, Math.ceil(band.to / binHz));
  if (last < first) return 0;
  let sum = 0;
  for (let i = first; i <= last; i++) sum += bins[i];
  return sum / ((last - first + 1) * MAX_BIN);
}
