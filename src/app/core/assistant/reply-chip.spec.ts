import { chipOf } from './reply-chip';

const base = { ask: [], commands: [] };

describe('chipOf', () => {
  it('names a keyword action by its tier and how long it took', () => {
    expect(chipOf({ ...base, via: 'keyword', tier: 1 }, 42)).toEqual({
      pips: '●○○',
      text: 'Tier 1 · Action · keyword · 42 ms',
      tone: 'tier',
    });
  });

  it('says how sure Jev was, and which model answered', () => {
    expect(
      chipOf({ ...base, via: 'jev', confidence: 0.834, tier: 2, by: 'Haiku' }, 1530).text,
    ).toBe('Tier 2 · Quick answer · via Jev 83% → Haiku · 1.5 s');
  });

  it('marks a failed quick answer', () => {
    const chip = chipOf({ ...base, via: 'pick', tier: 2, failed: 'no key' }, 10);

    expect(chip.text).toBe('Tier 2 · Quick answer · failed · your pick · 10 ms');
    expect(chip.tone).toBe('bad');
  });

  it('warms a proposal', () => {
    expect(chipOf({ ...base, via: 'skill', tier: 3 }, 5)).toEqual({
      pips: '●●●',
      text: 'Tier 3 · Proposal · skill · 5 ms',
      tone: 'task',
    });
  });

  it('says an action is asking which project', () => {
    expect(chipOf({ ...base, via: 'keyword', action: 'show-logs' }, 3).text).toBe(
      'Tier 1 · Which project · keyword · 3 ms',
    );
  });

  it('says keywords only when there was no model to ask, and unsure otherwise', () => {
    expect(chipOf({ ...base, via: 'keyword', note: 'Jev is off' }, 3)).toEqual({
      pips: '○○○',
      text: 'Keywords only · 3 ms',
      tone: 'tier',
    });
    expect(chipOf({ ...base, via: 'skill', note: 'no star map' }, 3).text).toBe('Skill · 3 ms');
    expect(chipOf({ ...base, via: 'jev', confidence: 0.4 }, 3).text).toBe(
      'Unsure · via Jev 40% · 3 ms',
    );
  });

  it('names an answer looked up on the web as one', () => {
    const chip = chipOf(
      {
        tier: 2,
        web: true,
        via: 'keyword',
        by: 'Claude Haiku · web search',
        ask: [],
        commands: [],
      },
      3400,
    );
    expect(chip.text).toBe('Tier 2 · Web answer · keyword → Claude Haiku · web search · 3.4 s');
  });
});
