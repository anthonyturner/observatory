import {
  agentLink,
  countName,
  inListOrder,
  notRunningText,
  rowsOf,
  runningCount,
  shortFolder,
  stateText,
  summaryText,
} from './live-agents-view';
import { SESSION, liveAgent } from './testing/live-agent-fixture';

const at = (minute: number): string => new Date(Date.UTC(2026, 9, 7, 9, minute)).toISOString();

describe('live agents view', () => {
  it('lists waiting agents first, then working, then quiet, the latest first in each', () => {
    const agents = [
      liveAgent({ title: 'quiet', state: 'quiet', lastActiveAt: at(9) }),
      liveAgent({ title: 'working early', lastActiveAt: at(1) }),
      liveAgent({ title: 'waiting', state: 'waiting', lastActiveAt: at(0) }),
      liveAgent({ title: 'working late', lastActiveAt: at(5) }),
    ];

    expect(inListOrder(agents).map((agent) => agent.title)).toEqual([
      'waiting',
      'working late',
      'working early',
      'quiet',
    ]);
  });

  it('says each state in words', () => {
    expect(stateText({ state: 'working', quietMinutes: null })).toBe('Working');
    expect(stateText({ state: 'waiting', quietMinutes: null })).toBe('Waiting for you');
    expect(stateText({ state: 'quiet', quietMinutes: 14 })).toBe('Quiet 14 min');
    expect(stateText({ state: 'not-running', quietMinutes: null })).toBe('Not running');
  });

  it('links a session and a subagent to their own pages', () => {
    expect(agentLink({ session: SESSION, agentId: null })).toEqual(['/agents', SESSION]);
    expect(agentLink({ session: SESSION, agentId: 'ab' })).toEqual(['/agents', SESSION, 'ab']);
  });

  it('counts every agent, or one repository’s in any case, and the ones waiting', () => {
    const agents = [
      liveAgent({ state: 'waiting' }),
      liveAgent({ repo: 'me/other' }),
      liveAgent({ repo: null }),
    ];

    expect(runningCount(agents, null)).toEqual({ running: 3, waiting: 1 });
    expect(runningCount(agents, 'Me/Observatory')).toEqual({ running: 1, waiting: 1 });
    expect(runningCount([], 'me/observatory')).toEqual({ running: 0, waiting: 0 });
  });

  it('names a badge by its count, leaving out what is zero', () => {
    expect(countName('Agents', { running: 3, waiting: 1 })).toBe(
      'Agents, 3 running, 1 waiting for you',
    );
    expect(countName('Agents', { running: 0, waiting: 0 })).toBe('Agents');
    expect(summaryText({ running: 1, waiting: 0 })).toBe('1 agent running.');
    expect(summaryText({ running: 3, waiting: 2 })).toBe('3 agents running, 2 waiting for you.');
  });

  it('cuts a folder to its last part', () => {
    expect(shortFolder('E:\\repos\\observatory-wt-490')).toBe('…\\observatory-wt-490');
    expect(shortFolder('/home/me/app')).toBe('…/app');
    expect(shortFolder('')).toBe('');
  });

  it('builds rows whose link is named by title, state, project and time', () => {
    const [row] = rowsOf([liveAgent({ agentId: 'ab', agent: 'ux', title: '' })]);
    const id = `agent-${SESSION}-ab`;

    expect(row.kicker).toBe('ux');
    expect(row.title).toBe('Untitled subagent');
    expect(row.labelledBy).toBe(`${id}-title ${id}-state ${id}-project ${id}-ago`);
    expect(row.ids.ago).toBe(`${id}-ago`);
  });

  it('says a stopped agent is not running and when it was last active', () => {
    const agent = liveAgent({ state: 'not-running', lastActiveAt: '2026-10-07T09:42:00' });

    expect(notRunningText(agent, 'en-GB')).toBe("This session isn't running. Last active 09:42.");
    expect(notRunningText({ ...agent, agentId: 'ab' }, 'en-GB')).toContain('This agent');
  });
});
