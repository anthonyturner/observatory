import { TestBed } from '@angular/core/testing';
import { RouteReply } from './assistant.types';
import { Conversation, TURNS_KEPT, TURN_MAX_LENGTH, withExchange } from './conversation';

const reply = (fields: Partial<RouteReply>): RouteReply => ({
  ask: [],
  commands: [],
  sources: [],
  ...fields,
});

describe('withExchange', () => {
  it('keeps the last turns only, a whole exchange at a time', () => {
    let turns = withExchange([], 'q0', 'a0');
    for (let n = 1; n <= TURNS_KEPT; n++) turns = withExchange(turns, `q${n}`, `a${n}`);

    expect(turns).toHaveLength(TURNS_KEPT);
    expect(turns[0]).toEqual({ role: 'user', text: `q${TURNS_KEPT / 2 + 1}` });
    expect(turns.at(-1)).toEqual({ role: 'assistant', text: `a${TURNS_KEPT}` });
  });

  it('trims each turn and clips it to the longest the router takes', () => {
    const [asked, answered] = withExchange([], '  hi  ', 'x'.repeat(TURN_MAX_LENGTH + 5));

    expect(asked.text).toBe('hi');
    expect(answered.text).toHaveLength(TURN_MAX_LENGTH);
  });
});

describe('Conversation', () => {
  const conversation = () => TestBed.inject(Conversation);

  it('records what was asked with what Jev said, or what an action said', () => {
    conversation().record('what is a rebase', reply({ tier: 2, text: 'It replays commits.' }));
    conversation().record('open the orrery', reply({ tier: 1, says: 'Opening the orrery' }));

    expect(
      conversation()
        .history()
        .map((turn) => turn.text),
    ).toEqual(['what is a rebase', 'It replays commits.', 'open the orrery', 'Opening the orrery']);
  });

  it('records nothing for a reply that said nothing, and forgets on clear', () => {
    conversation().record('refresh', reply({ tier: 1, op: 'refresh' }));
    expect(conversation().hasTurns()).toBe(false);

    conversation().record('hi', reply({ tier: 2, text: 'Hello.' }));
    conversation().clear();

    expect(conversation().history()).toEqual([]);
  });
});
