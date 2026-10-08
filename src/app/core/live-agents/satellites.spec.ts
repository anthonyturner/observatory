import { liveAgent } from './testing/live-agent-fixture';
import { SatelliteSources, satellitesOf } from './satellites';

const pulls = [
  { number: 12, branch: 'feat/490-agents', base: 'main' },
  { number: 13, branch: 'fix/other', base: 'main' },
];
const sources = (overrides: Partial<SatelliteSources> = {}): SatelliteSources => ({
  agents: [liveAgent()],
  repo: 'Me/Observatory',
  pulls,
  crewed: new Set(),
  ...overrides,
});

describe('satellitesOf', () => {
  it('puts an agent on the pull request whose head branch it works on', () => {
    expect(satellitesOf(sources())).toEqual([
      {
        key: `${liveAgent().session}/`,
        name: 'Build the agents list',
        state: 'working',
        pr: 12,
        stateText: 'Working',
      },
    ]);
  });

  it('parks an agent on no pull request’s branch, or on none at all', () => {
    const agents = [liveAgent({ branch: 'main' }), liveAgent({ branch: null, agentId: 'a1' })];

    expect(satellitesOf(sources({ agents })).map((each) => each.pr)).toEqual([null, null]);
  });

  it('parks an agent on a branch two pull requests share, as stacking does', () => {
    const twin = [...pulls, { number: 14, branch: 'feat/490-agents', base: 'main' }];

    expect(satellitesOf(sources({ pulls: twin }))[0].pr).toBeNull();
  });

  it('keeps only running agents in this repository, whatever its case', () => {
    const agents = [
      liveAgent({ repo: 'other/thing' }),
      liveAgent({ repo: null }),
      liveAgent({ state: 'not-running' }),
      liveAgent({ state: 'quiet', quietMinutes: 14, agentId: 'a1' }),
    ];

    const found = satellitesOf(sources({ agents }));

    expect(found.map((each) => each.stateText)).toEqual(['Quiet 14 min']);
  });

  it('gives a session and its subagent a satellite each', () => {
    const agents = [liveAgent(), liveAgent({ agentId: 'a1', agent: 'ux' })];

    const keys = satellitesOf(sources({ agents })).map((each) => each.key);

    expect(new Set(keys).size).toBe(2);
  });

  it('leaves out a headless run on a crewed pull request, which is already a ship', () => {
    const agents = [
      liveAgent({ isHeadless: true }),
      liveAgent({ isHeadless: false, agentId: 'a1' }),
      liveAgent({ isHeadless: true, branch: 'fix/other', agentId: 'a2' }),
    ];

    const found = satellitesOf(sources({ agents, crewed: new Set([12]) }));

    expect(found.map((each) => each.pr)).toEqual([12, 13]);
  });
});
