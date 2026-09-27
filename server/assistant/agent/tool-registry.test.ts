import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { proposer } from '../proposal.ts';
import { agentTools } from '../tools/agent-tools.ts';
import { ToolArgError } from '../tools/tool-args.ts';
import type { AgentTool, ToolContext } from './agent-tool.ts';
import { toolRegistry } from './tool-registry.ts';

const context: ToolContext = { projects: [] };

const tool = (name: string, run: AgentTool['run']): AgentTool => ({
  name,
  description: `The ${name} tool.`,
  parameters: { type: 'object' },
  run,
});

const call = (name: string, args: string) => ({ id: 'c', name, arguments: args });

describe('toolRegistry', () => {
  it('describes each tool to the model, and runs one by name with its arguments', async () => {
    const registry = toolRegistry([tool('echo', async (args) => ({ content: args }))]);

    assert.deepEqual(registry.specs, [
      { name: 'echo', description: 'The echo tool.', parameters: { type: 'object' } },
    ]);
    assert.deepEqual(await registry.run(call('echo', '{"a":1}'), context), { content: { a: 1 } });
    assert.deepEqual(await registry.run(call('echo', ''), context), { content: {} });
  });

  it('answers a call the model got wrong with an error it can read', async () => {
    const registry = toolRegistry([
      tool('picky', async () => {
        throw new ToolArgError('project is required');
      }),
    ]);

    const errorOf = async (name: string, args: string) =>
      (await registry.run(call(name, args), context)).content;

    assert.deepEqual(await errorOf('nope', '{}'), { error: 'There is no tool called nope.' });
    assert.deepEqual(await errorOf('picky', '{'), { error: 'The arguments were not JSON.' });
    assert.deepEqual(await errorOf('picky', '[1]'), { error: 'The arguments must be an object.' });
    assert.deepEqual(await errorOf('picky', '{}'), { error: 'project is required' });
  });

  it('logs a tool that fails to read, and tells the model only that it could not', async () => {
    const warned: string[] = [];
    const registry = toolRegistry(
      [
        tool('broken', async () => {
          throw new Error('gh exited 1');
        }),
      ],
      (line) => warned.push(line),
    );

    const result = await registry.run(call('broken', '{}'), context);

    assert.deepEqual(result, { content: { error: 'That could not be read just now.' } });
    assert.deepEqual(warned, ["Jev's broken failed: gh exited 1"]);
  });

  it('holds every tool Jev has, each named once', () => {
    const unread = async () => assert.fail('not read here');
    const tools = agentTools({
      reads: { projects: unread, queue: unread, issues: unread, usage: unread },
      proposals: proposer({ shells: ['bash'], runner: null }),
    });

    assert.deepEqual(
      tools.map((each) => each.name),
      [
        'list_projects',
        'project_pull_requests',
        'project_issues',
        'usage_summary',
        'open_page',
        'refresh',
        'show_help',
        'propose_task',
      ],
    );
  });
});
