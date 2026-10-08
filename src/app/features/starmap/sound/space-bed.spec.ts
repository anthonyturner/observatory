import { BED_RECORDINGS, ClipBytes, SpaceBed, bedGainFor } from './space-bed';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

/** A stand-in for the audio device: no sound is made, only what is played is recorded. */
function fakeAudio() {
  const sources: { buffer: unknown; loop: boolean; start: ReturnType<typeof vi.fn> }[] = [];
  const level = { gain: { value: 1, setTargetAtTime: vi.fn() }, connect: vi.fn() };
  const decoded = { decoded: true };
  const ac = {
    currentTime: 4,
    createGain: () => level,
    createBufferSource: () => {
      const source = { buffer: null, loop: false, start: vi.fn(), connect: vi.fn() };
      sources.push(source);
      return source;
    },
    decodeAudioData: vi.fn(async () => decoded),
  };
  return { ac: ac as unknown as AudioContext, level, sources, decoded, decode: ac.decodeAudioData };
}

const FILES = BED_RECORDINGS.map((recording) => recording.file);

describe('bedGainFor', () => {
  it('is silent for an empty queue and louder as more is open', () => {
    expect(bedGainFor(0)).toBe(0);
    expect(bedGainFor(1)).toBeGreaterThan(0);
    expect(bedGainFor(5)).toBeGreaterThan(bedGainFor(1));
    expect(bedGainFor(12)).toBeGreaterThan(bedGainFor(5));
  });

  it('stops growing at a full queue', () => {
    expect(bedGainFor(20)).toBe(bedGainFor(400));
    expect(bedGainFor(400)).toBeLessThanOrEqual(0.25);
  });

  it('treats a nonsense count as an empty queue', () => {
    expect(bedGainFor(-3)).toBe(0);
  });
});

describe('SpaceBed', () => {
  it('fetches nothing until asked, then loops every clip', async () => {
    const { ac, sources, decoded } = fakeAudio();
    const bytes = vi.fn<ClipBytes>(async () => new ArrayBuffer(8));
    const bed = new SpaceBed(ac, {} as AudioNode, bytes);
    expect(bytes).not.toHaveBeenCalled();

    bed.load();
    await flush();

    expect(bytes.mock.calls.map(([url]) => url)).toEqual(FILES);
    expect(sources).toHaveLength(FILES.length);
    expect(
      sources.every((s) => s.loop && s.buffer === decoded && s.start.mock.calls.length === 1),
    ).toBe(true);
  });

  it('does not fetch a clip twice', async () => {
    const { ac, sources } = fakeAudio();
    const bytes = vi.fn<ClipBytes>(async () => new ArrayBuffer(8));
    const bed = new SpaceBed(ac, {} as AudioNode, bytes);

    bed.load();
    bed.load();
    await flush();
    bed.load();
    await flush();

    expect(bytes).toHaveBeenCalledTimes(FILES.length);
    expect(sources).toHaveLength(FILES.length);
  });

  it('plays on without a clip that cannot be fetched, and tries it again next time', async () => {
    const { ac, sources } = fakeAudio();
    let failing = true;
    const bytes = vi.fn(async (url: string) => {
      if (failing && url === FILES[0]) throw new Error('offline');
      return new ArrayBuffer(8);
    });
    const bed = new SpaceBed(ac, {} as AudioNode, bytes);

    bed.load();
    await flush();
    expect(sources).toHaveLength(FILES.length - 1);

    failing = false;
    bed.load();
    await flush();
    expect(sources).toHaveLength(FILES.length);
  });

  it('skips a clip that cannot be decoded', async () => {
    const { ac, sources, decode } = fakeAudio();
    decode.mockRejectedValue(new Error('unsupported'));
    const bed = new SpaceBed(ac, {} as AudioNode, async () => new ArrayBuffer(8));

    bed.load();
    await flush();

    expect(sources).toEqual([]);
  });

  it('glides to the loudness for the open count', () => {
    const { ac, level } = fakeAudio();
    const bed = new SpaceBed(ac, {} as AudioNode, async () => new ArrayBuffer(8));

    bed.setOpen(7);

    expect(level.gain.setTargetAtTime).toHaveBeenCalledWith(bedGainFor(7), 4, expect.any(Number));
  });
});

describe('BED_RECORDINGS', () => {
  it('credits every recording to NASA, with a page it came from', () => {
    expect(BED_RECORDINGS.length).toBeGreaterThanOrEqual(2);
    for (const recording of BED_RECORDINGS) {
      expect(recording.credit).toMatch(/^NASA\/JPL-Caltech$/);
      expect(recording.source).toMatch(/^https:\/\/(science|www)\.nasa\.gov\//);
      expect(recording.mission).not.toBe('');
    }
  });
});
