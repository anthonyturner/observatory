import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ToolContext } from '../agent/agent-tool.ts';
import { proposer } from '../proposal.ts';
import type { RunOffer } from '../route-contract.ts';
import { openPageTool } from './open-page.ts';
import { refreshTool, showHelpTool } from './page-op.ts';
import { proposeTaskTool } from './propose-task.ts';
import { ToolArgError } from './tool-args.ts';

const context: ToolContext = {
  projects: [
    { name: 'app', repo: 'me/app', href: '/p/me/app' },
    { name: 'site', repo: 'me/site', href: '/p/me/site' },
  ],
};

const refusedWith = (message: RegExp) => (error: Error) =>
  error instanceof ToolArgError && message.test(error.message);

describe('open_page', () => {
  it('opens a project’s page, choosing it for the reply', async () => {
    const result = await openPageTool.run({ target: 'show-issues', project: 'site' }, context);

    assert.deepEqual(result, {
      content: { opening: 'Opening site · Issues' },
      effect: {
        kind: 'action',
        reply: {
          tier: 1,
          action: 'show-issues',
          href: '/p/me/site#issues',
          says: 'Opening site · Issues',
        },
      },
    });
  });

  it('opens a page that needs no project', async () => {
    const result = await openPageTool.run({ target: 'open-orrery' }, context);

    assert.equal(
      result.effect?.kind === 'action' && 'href' in result.effect.reply && result.effect.reply.href,
      '/orrery',
    );
  });

  it('refuses a target that is not a page, an op included', async () => {
    await assert.rejects(
      openPageTool.run({ target: 'refresh' }, context),
      refusedWith(/No such page/),
    );
    await assert.rejects(
      openPageTool.run({ target: 'explode' }, context),
      refusedWith(/No such page/),
    );
  });

  it('asks for a project when the page needs one and none was named', async () => {
    await assert.rejects(
      openPageTool.run({ target: 'show-logs' }, context),
      refusedWith(/needs a project/),
    );
  });
});

describe('refresh and show_help', () => {
  it('choose the page’s own op', async () => {
    const refresh = await refreshTool.run({}, context);
    const help = await showHelpTool.run({}, context);

    assert.deepEqual(refresh.effect, {
      kind: 'action',
      reply: { tier: 1, action: 'refresh', op: 'refresh' },
    });
    assert.deepEqual(help.effect, {
      kind: 'action',
      reply: { tier: 1, action: 'help', op: 'help' },
    });
  });
});

describe('propose_task', () => {
  const runnerOffering = (offer: RunOffer) => ({ offer: async () => offer });
  const RUN = {
    token: 't',
    folder: '/code/app',
    name: 'app',
    expiresAt: 1,
    limitMs: 2,
    command: 'claude',
  };

  it('proposes through the proposer, with the runner’s ticket, choosing it for the reply', async () => {
    const tool = proposeTaskTool(
      proposer({ shells: ['bash'], runner: runnerOffering({ run: RUN }) }),
    );

    const result = await tool.run({ prompt: 'Fix the test', project: 'app' }, context);

    assert.deepEqual(result.content, { proposed: true, project: 'app', canRunHere: true });
    assert.deepEqual(result.effect, {
      kind: 'proposal',
      proposal: {
        tier: 3,
        prompt: 'Fix the test',
        command: 'claude -p "Fix the test"',
        commands: [{ shell: 'bash', command: 'claude -p "Fix the test"' }],
        project: 'app',
        run: RUN,
      },
    });
  });

  it('says why it cannot run here', async () => {
    const tool = proposeTaskTool(proposer({ shells: ['bash'], runner: null }));

    const result = await tool.run({ prompt: 'Fix it' }, context);

    assert.deepEqual(result.content, { proposed: true, project: null, canRunHere: false });
  });

  it('asks which project when the runner offers several', async () => {
    const runner = runnerOffering({ choose: ['me/app', 'me/site'] });
    const tool = proposeTaskTool(proposer({ shells: ['bash'], runner }));

    await assert.rejects(
      tool.run({ prompt: 'Fix it' }, context),
      refusedWith(/which project.*app, site/),
    );
  });

  it('refuses a prompt that is missing or too long', async () => {
    const tool = proposeTaskTool(proposer({ shells: ['bash'], runner: null }));

    await assert.rejects(tool.run({}, context), refusedWith(/prompt is required/));
    await assert.rejects(
      tool.run({ prompt: 'x'.repeat(2001) }, context),
      refusedWith(/at most 2000/),
    );
  });
});
