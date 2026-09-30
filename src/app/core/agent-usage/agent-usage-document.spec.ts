import { parseAgentUsage } from './agent-usage-document';
import { agentRun } from './testing/agent-run-fixture';

describe('parseAgentUsage', () => {
  it('reads the report and its runs', () => {
    const run = agentRun('a', { issue: 217, branch: 'feat/217-x' });
    const document = parseAgentUsage({
      generatedAt: 'g',
      days: 30,
      from: '2026-09-01',
      runs: [run],
    });

    expect(document?.days).toBe(30);
    expect(document?.runs).toEqual([run]);
  });

  it('drops a malformed run rather than the whole report', () => {
    const document = parseAgentUsage({
      runs: [agentRun('a'), { id: 'b', agent: 'dev' }, { ...agentRun('c'), workTokens: -5 }, null],
    });

    expect(document?.runs.map((run) => run.id)).toEqual(['a']);
  });

  it('fills what a run leaves out rather than guessing', () => {
    const { id, agent, startedAt, endedAt, workTokens, peakContext } = agentRun('a');
    const bare = { id, agent, startedAt, endedAt, workTokens, peakContext };
    const [run] = parseAgentUsage({ runs: [bare] })?.runs ?? [];

    expect([
      run.description,
      run.repo,
      run.branch,
      run.issue,
      run.pull,
      run.model,
      run.toolUses,
    ]).toEqual(['', null, null, null, null, null, 0]);
  });

  it('is no report at all for a body without runs, as a hosted visitor gets', () => {
    expect(parseAgentUsage(null)).toBeNull();
    expect(parseAgentUsage({ generatedAt: 'g' })).toBeNull();
  });
});
