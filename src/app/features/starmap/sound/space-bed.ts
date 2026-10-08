/* A bed of real recordings from space under the score: NASA's Mars rovers and
   landers, looped, and louder the more is open in the queue. The clips, their
   sources and their credit lines are in public/audio/space/CREDITS.md. */

/** One recording in the bed, with where it came from. */
export interface Recording {
  /** Served from public/, relative to the page's base href. */
  readonly file: string;
  readonly title: string;
  readonly mission: string;
  readonly credit: string;
  /** The NASA page that publishes it. */
  readonly source: string;
}

/** Only recordings credited to NASA alone belong here: NASA's own media is public domain, a university's or a partner agency's is not. */
export const BED_RECORDINGS: readonly Recording[] = [
  {
    file: 'audio/space/mars-rover-drive.opus',
    title: 'Perseverance rolling across Jezero Crater, sol 16',
    mission: 'Mars 2020 Perseverance',
    credit: 'NASA/JPL-Caltech',
    source:
      'https://science.nasa.gov/resource/sounds-of-perseverance-mars-rover-driving-sol-16-16-minutes/',
  },
  {
    file: 'audio/space/mars-insight-seismic.opus',
    title: 'InSight’s seismometer hearing wind, its arm and its own creaks, sol 98',
    mission: 'InSight',
    credit: 'NASA/JPL-Caltech',
    source: 'https://science.nasa.gov/resource/listen-to-nasas-insight-at-work-on-mars/',
  },
];

/** The clips are mastered to about -23 LUFS, so this is how far under full scale a full queue sits: some 12 dB under the drone. */
const BED_MAX = 0.25;

/** Twenty open pull requests is a full queue. */
const FULL_QUEUE = 20;

/** Silent when nothing is open; each extra pull request is worth less than the one before. */
export const bedGainFor = (open: number): number =>
  BED_MAX * Math.min(1, Math.log1p(Math.max(0, open)) / Math.log1p(FULL_QUEUE));

/** The undecoded bytes of a clip; behind a type so tests need no network. */
export type ClipBytes = (url: string) => Promise<ArrayBuffer>;

const fetchClip: ClipBytes = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.arrayBuffer();
};

/**
 * Loops each clip under the score and sets how loud they are together from the
 * open count. A clip that cannot be fetched or decoded is skipped, so the worst
 * case is the score without its bed, and the next `load` tries it again.
 */
export class SpaceBed {
  private readonly level: GainNode;
  private readonly wanted = new Set<string>();

  constructor(
    private readonly ac: AudioContext,
    into: AudioNode,
    private readonly bytes: ClipBytes = fetchClip,
  ) {
    this.level = ac.createGain();
    this.level.gain.value = 0;
    this.level.connect(into);
  }

  /** Fetches whatever is not loaded or loading yet; the clips start as they arrive. */
  load(): void {
    for (const { file: url } of BED_RECORDINGS) {
      if (this.wanted.has(url)) continue;
      this.wanted.add(url);
      void this.play(url);
    }
  }

  /** Glides to the loudness for `open` pull requests. */
  setOpen(open: number): void {
    this.level.gain.setTargetAtTime(bedGainFor(open), this.ac.currentTime, 2.5);
  }

  private async play(url: string): Promise<void> {
    try {
      const buffer = await this.ac.decodeAudioData(await this.bytes(url));
      const source = this.ac.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.level);
      source.start();
    } catch {
      // A missing recording is a quieter sky, not an error to show.
      this.wanted.delete(url);
    }
  }
}
