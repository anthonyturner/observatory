import { parseAgentChanges } from './agent-changes-parse';
import { agentChanges } from './testing/agent-changes-fixture';

describe('parseAgentChanges', () => {
  it('reads a diff answer', () => {
    const changes = agentChanges({ skippedLarge: ['dump.json'], untrackedOverCap: 3 });

    expect(
      parseAgentChanges({ generatedAt: 'now', changes: { kind: 'diff', ...changes } }),
    ).toEqual({ status: 'ready', changes });
  });

  it('reads a problem, whatever folder it names', () => {
    expect(
      parseAgentChanges({ changes: { kind: 'problem', problem: 'timed-out', folder: 'C:/x' } }),
    ).toEqual({ status: 'problem', problem: 'timed-out' });
  });

  it('drops odd fields rather than trusting them', () => {
    const parsed = parseAgentChanges({
      changes: {
        kind: 'diff',
        folder: 'C:/x',
        base: 'origin/main',
        diffBytes: -4,
        skippedLarge: [1, 'a'],
      },
    });

    expect(parsed).toEqual({
      status: 'ready',
      changes: agentChanges({
        folder: 'C:/x',
        readFrom: 'C:/x',
        branch: null,
        repo: null,
        diff: '',
        diffBytes: 0,
        skippedLarge: ['a'],
      }),
    });
  });

  it('is null for a body that is not the answer', () => {
    for (const body of [
      null,
      {},
      { changes: { kind: 'problem', problem: 'what' } },
      { changes: { kind: 'diff' } },
    ]) {
      expect(parseAgentChanges(body)).toBeNull();
    }
  });
});
