import { SkyEngine } from '../engine/sky-engine';
import { SkyStar } from '../engine/sky-model';
import { anIssue } from '../../../core/issues/testing/issues-fixture';
import { NurseryBody } from './nursery-layout';
import { NurserySky } from './nursery-sky';

/** The two fields narrowing sets; the engine itself needs a real canvas. */
const fakeEngine = (): SkyEngine => ({ filter: null, fitsFiltered: true }) as unknown as SkyEngine;

const bodyStar = (labels: { name: string; color: string }[], comet: boolean): SkyStar =>
  ({
    kind: 'issue',
    data: { issue: anIssue(1, { labels, comet }) } as Partial<NurseryBody>,
  }) as unknown as SkyStar;

describe('NurserySky.narrow', () => {
  const none = { label: '', query: '', cometsOnly: false };

  it('dims what the label does not match and lights its arm, without narrowing Fit', () => {
    const sky = new NurserySky(document);
    const engine = fakeEngine();

    const switched = sky.narrow(engine, { ...none, label: 'bug' });

    expect(switched).toBe(false);
    expect(engine.filter?.(bodyStar([{ name: 'bug', color: 'd73a4a' }], true))).toBe(true);
    expect(engine.filter?.(bodyStar([], true))).toBe(false);
    expect(engine.fitsFiltered).toBe(false);
    expect(sky.layer.litLabel).toBe('bug');
  });

  it('frames only the comets, and says they were switched', () => {
    const sky = new NurserySky(document);
    const engine = fakeEngine();

    expect(sky.narrow(engine, { ...none, cometsOnly: true })).toBe(true);
    expect(engine.fitsFiltered).toBe(true);
    expect(engine.filter?.(bodyStar([], false))).toBe(false);
    expect(sky.narrow(engine, none)).toBe(true);
    expect(engine.filter).toBeNull();
  });
});
