import { BAR_S, STEP_S, TONIC, barAt } from './ambient-score';
import { GrooveHit, STEPS, buildsAt, grooveFor } from './trance-groove';

const bar = barAt(1);
const offsetsOf = (hits: readonly GrooveHit[], kind: GrooveHit['kind']): number[] =>
  hits.filter((hit) => hit.kind === kind).map((hit) => Math.round(hit.offsetS / STEP_S));

describe('grooveFor', () => {
  it('lays sixteen beats of sixteenth notes across the chord', () => {
    expect(STEPS).toBe(64);
    for (const hit of grooveFor(0, bar)) {
      expect(hit.offsetS).toBeGreaterThanOrEqual(0);
      expect(hit.offsetS).toBeLessThan(BAR_S);
    }
  });

  it('kicks four to the floor, with a clap on the backbeat', () => {
    const hits = grooveFor(0, bar);
    expect(offsetsOf(hits, 'kick')).toEqual(Array.from({ length: 16 }, (_, beat) => beat * 4));
    expect(offsetsOf(hits, 'clap')).toEqual(Array.from({ length: 8 }, (_, i) => i * 8 + 4));
  });

  it('rolls the bass on the root between the kicks', () => {
    const bass = grooveFor(0, bar).filter((hit) => hit.kind === 'bass');
    expect(bass).toHaveLength(48);
    for (const hit of bass) {
      expect(Math.round(hit.offsetS / STEP_S) % 4).not.toBe(0);
      if (hit.kind === 'bass') expect(hit.midi).toBe(bar.root + 12);
    }
  });

  it('opens a hat on every off-beat, and fills the sixteenths only under strain', () => {
    const calm = grooveFor(0, bar, 0).filter((hit) => hit.kind === 'hat');
    expect(calm.every((hit) => hit.kind === 'hat' && hit.open)).toBe(true);
    expect(calm.map((hit) => Math.round(hit.offsetS / STEP_S) % 4)).toEqual(Array(16).fill(2));
    expect(grooveFor(0, bar, 0.8).filter((hit) => hit.kind === 'hat')).toHaveLength(48);
  });

  it('arpeggiates the chord on every sixteenth, higher under strain', () => {
    const calm = grooveFor(0, bar, 0).filter((hit) => hit.kind === 'arp');
    expect(calm).toHaveLength(STEPS);
    const tones = bar.chord.map((tone) => ((tone % 12) + 12) % 12);
    for (const hit of calm) {
      if (hit.kind === 'arp') expect(tones).toContain((((hit.midi - TONIC) % 12) + 12) % 12);
    }
    const strained = grooveFor(0, bar, 1).filter((hit) => hit.kind === 'arp');
    expect(
      strained[0].kind === 'arp' && calm[0].kind === 'arp' && strained[0].midi - calm[0].midi,
    ).toBe(12);
  });

  it('drops the kick and bass for a rising snare roll at the end of each phrase', () => {
    expect([0, 1, 6, 7, 15].map(buildsAt)).toEqual([false, false, false, true, true]);
    const hits = grooveFor(7, bar);
    expect(offsetsOf(hits, 'kick').every((step) => step < 48)).toBe(true);
    expect(offsetsOf(hits, 'bass').every((step) => step < 48)).toBe(true);
    const roll = hits.filter((hit) => hit.kind === 'clap' && hit.offsetS >= 48 * STEP_S);
    expect(roll).toHaveLength(16);
    const levels = roll.map((hit) => (hit.kind === 'clap' ? hit.level : 0));
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });
});
