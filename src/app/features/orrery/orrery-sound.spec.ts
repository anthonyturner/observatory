import { OrreryCues } from './orrery-sound';

describe('OrreryCues', () => {
  it('hands each cue to the score once', () => {
    const cues = new OrreryCues();
    cues.push({ fromPan: 0, toPan: 0.5 });

    expect(cues.take()).toEqual([{ fromPan: 0, toPan: 0.5 }]);
    expect(cues.take()).toEqual([]);
  });

  it('keeps only the latest few when nothing is listening, so a crowd is not replayed', () => {
    const cues = new OrreryCues();
    for (let i = 0; i < 20; i++) cues.push({ fromPan: i / 100, toPan: 0 });

    const held = cues.take();

    expect(held.length).toBeLessThan(10);
    expect(held[held.length - 1].fromPan).toBe(0.19);
  });
});
