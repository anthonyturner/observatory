import { RouteReply } from './assistant.types';
import { outcomeOf } from './ask-outcome';

const reply = (fields: Partial<RouteReply>): RouteReply => ({ ask: [], commands: [], ...fields });

describe('outcomeOf', () => {
  it('answers at the reply’s tier', () => {
    expect(outcomeOf(reply({ tier: 1 }))).toEqual({ kind: 'answered', tier: 1 });
    expect(outcomeOf(reply({ tier: 2, text: 'yes' }))).toEqual({ kind: 'answered', tier: 2 });
    expect(outcomeOf(reply({ tier: 3 }))).toEqual({ kind: 'answered', tier: 3 });
  });

  it('fails a quick answer that could not be had', () => {
    expect(outcomeOf(reply({ tier: 2, failed: 'timed out' }))).toEqual({ kind: 'failed' });
  });

  it('is unsure of a task that asks which project, or a reply with no tier', () => {
    const ask = [{ label: 'app', pick: { project: 'app' } }];
    expect(outcomeOf(reply({ tier: 3, ask }))).toEqual({ kind: 'unsure' });
    expect(outcomeOf(reply({ note: 'Not sure.' }))).toEqual({ kind: 'unsure' });
  });
});
