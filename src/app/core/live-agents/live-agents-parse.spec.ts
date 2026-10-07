import { parseLiveAgent, parseLiveAgents, parseOneAgent } from './live-agents-parse';
import { liveAgent } from './testing/live-agent-fixture';

describe('live agents parse', () => {
  it('reads an agent as the API sends it', () => {
    const agent = liveAgent({ agentId: 'ab12', agent: 'ux', isHeadless: true, quietMinutes: 4 });

    expect(parseLiveAgent(JSON.parse(JSON.stringify(agent)))).toEqual(agent);
  });

  it('drops an agent with no session, state or time, and blanks any other odd field', () => {
    expect(parseLiveAgent({ ...liveAgent(), session: 7 })).toBeNull();
    expect(parseLiveAgent({ ...liveAgent(), state: 'asleep' })).toBeNull();
    expect(parseLiveAgent({ ...liveAgent(), lastActiveAt: 'soon' })).toBeNull();

    const odd = parseLiveAgent({ ...liveAgent(), title: 3, branch: {}, quietMinutes: 'x' });
    expect(odd).toEqual(liveAgent({ title: '', branch: null }));
  });

  it('reads the list, keeping the agents it can', () => {
    expect(parseLiveAgents({ agents: [liveAgent(), { session: 'x' }] })).toEqual([liveAgent()]);
    expect(parseLiveAgents({ error: 'not found' })).toBeNull();
  });

  it('reads one agent, none, or a body that is neither', () => {
    expect(parseOneAgent({ agent: liveAgent() })).toEqual(liveAgent());
    expect(parseOneAgent({ agent: null })).toBeNull();
    expect(parseOneAgent({ agent: { session: 'x' } })).toBeUndefined();
    expect(parseOneAgent([])).toBeUndefined();
  });
});
