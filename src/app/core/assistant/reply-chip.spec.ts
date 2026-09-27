import { chipOf } from './reply-chip';

const base = { ask: [], commands: [], sources: [] };

describe('chipOf', () => {
  it('names a keyword action by its tier and how long it took', () => {
    expect(chipOf({ ...base, via: 'keyword', tier: 1 }, 42)).toEqual({
      pips: '●○○',
      text: 'Tier 1 · Action · keyword · 42 ms',
      tone: 'tier',
    });
  });

  it('says Jev answered, and which model it answered through', () => {
    expect(chipOf({ ...base, via: 'agent', tier: 2, by: 'Haiku' }, 1530).text).toBe(
      'Tier 2 · Answer · Jev → Haiku · 1.5 s',
    );
    expect(chipOf({ ...base, via: 'agent', tier: 1 }, 10).text).toBe(
      'Tier 1 · Action · Jev · 10 ms',
    );
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

  it('says keywords only when there was no model to ask, and options otherwise', () => {
    expect(chipOf({ ...base, via: 'keyword', note: 'Jev is off' }, 3)).toEqual({
      pips: '○○○',
      text: 'Keywords only · 3 ms',
      tone: 'tier',
    });
    expect(chipOf({ ...base, via: 'skill', note: 'no star map' }, 3).text).toBe('Skill · 3 ms');
    expect(chipOf({ ...base, via: 'pick' }, 3).text).toBe('Options · your pick · 3 ms');
  });
});
