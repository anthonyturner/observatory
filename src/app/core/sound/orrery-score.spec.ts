import {
  CHORDS,
  LOOP_STEPS,
  MAX_VOICES,
  STEPS_PER_BAR,
  SystemSound,
  TONIC,
  WorldVoice,
  euclid,
  motifFor,
  pulsesFor,
  stepEvents,
} from './orrery-score';

const voice = (key: string, overrides: Partial<WorldVoice> = {}): WorldVoice => ({
  key,
  severity: 'clear',
  open: 4,
  rotate: 0,
  pan: 0,
  ...overrides,
});
const system = (voices: WorldVoice[], blocked = 0, totalOpen = 10): SystemSound => ({
  voices,
  totalOpen,
  blocked,
});
const kinds = (step: number, sound: SystemSound): string[] =>
  stepEvents(step, sound).map((e) => e.kind);

describe('euclid', () => {
  it('spreads pulses as evenly as they fall', () => {
    expect(euclid(4, 16).filter(Boolean)).toHaveLength(4);
    expect(
      euclid(3, 8)
        .map((hit) => (hit ? 'x' : '.'))
        .join(''),
    ).toBe('x..x..x.');
  });

  it('gives a busier world more pulses, from one to nine', () => {
    expect(pulsesFor(0)).toBe(1);
    expect(pulsesFor(20)).toBeGreaterThan(pulsesFor(2));
    expect(pulsesFor(500)).toBe(9);
  });
});

describe('stepEvents', () => {
  it('lays a pad and the sun’s beat on the downbeat, a hat on the off-beat', () => {
    expect(kinds(0, system([]))).toEqual(expect.arrayContaining(['pad', 'thump', 'bass']));
    expect(kinds(2, system([]))).toContain('hat');
    expect(kinds(1, system([]))).toEqual([]);
  });

  it('beats harder the more is open', () => {
    const level = (open: number): number =>
      (stepEvents(0, system([], 0, open)).find((e) => e.kind === 'thump') as { level: number })
        .level;
    expect(level(60)).toBeGreaterThan(level(0));
  });

  it('sweeps once a bar only while something is blocked', () => {
    expect(kinds(0, system([], 0))).not.toContain('sweep');
    expect(kinds(0, system([], 2))).toContain('sweep');
    expect(kinds(STEPS_PER_BAR + 1, system([], 2))).not.toContain('sweep');
  });

  it('walks the four chords, one a bar', () => {
    const pad = (step: number) =>
      (
        stepEvents(step, system([])).find((e) => e.kind === 'pad') as {
          readonly notes: readonly number[];
        }
      ).notes;
    expect(pad(0)).toEqual(CHORDS[0].map((n) => TONIC + n));
    expect(pad(STEPS_PER_BAR * 3)).toEqual(CHORDS[3].map((n) => TONIC + n));
    expect(pad(LOOP_STEPS)).toEqual(pad(0));
  });

  it('plays each world in its own instrument, from where it sits, on its chord', () => {
    const blocked = voice('b', { severity: 'blocked', open: 40, pan: -0.5 });
    const plucks = Array.from({ length: STEPS_PER_BAR }, (_, step) =>
      stepEvents(step, system([blocked])),
    )
      .flat()
      .filter((e) => e.kind === 'pluck');
    expect(plucks.length).toBe(pulsesFor(40));
    for (const pluck of plucks) {
      expect(pluck).toMatchObject({ severity: 'blocked', pan: -0.5 });
    }
  });

  it('plays no more than twelve worlds at once', () => {
    const many = Array.from({ length: 30 }, (_, i) => voice(`w${i}`, { open: 500 }));
    const plucks = stepEvents(0, system(many)).filter((e) => e.kind === 'pluck');
    expect(plucks.length).toBeLessThanOrEqual(MAX_VOICES);
  });
});

describe('motifFor', () => {
  it('rises through the chord of the moment in the world’s instrument', () => {
    const motif = motifFor(voice('a', { severity: 'waiting' }), 0);
    expect(motif.map((e) => (e as { midi: number }).midi)).toEqual(
      CHORDS[0].map((n) => TONIC + 24 + n),
    );
    expect(motif.every((e) => (e as { severity: string }).severity === 'waiting')).toBe(true);
  });
});
