import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequest } from '../http/api-handler.ts';
import type { AgentEffect } from './agent/agent-tool.ts';
import type { Agent, AgentRequest, AgentRun } from './agent/jev-agent.ts';
import { type AssistantOptions, assistantRouter } from './assistant-router.ts';
import { type FailureReason, OpenRouterError } from './open-router-error.ts';
import { proposer } from './proposal.ts';
import type {
  HistoryTurn,
  Pick,
  Project,
  ProposalRunner,
  RouteRequest,
  RunOffer,
} from './route-contract.ts';
import { SKILLS } from './skills-table.ts';

const observatory: Project = {
  name: 'observatory',
  repo: 'me/observatory',
  href: '/p/me/observatory',
};
const app: Project = { name: 'app', repo: 'me/app', href: '/p/me/app' };

/** An agent that answers as told, remembering what it was asked; off when told nothing. */
function fakeAgent(answer: AgentRun | FailureReason | null) {
  const asked: AgentRequest[] = [];
  const agent: Agent = {
    isOn: answer !== null,
    by: 'Claude Haiku',
    answer: async (request) => {
      asked.push(request);
      if (answer === null) throw new OpenRouterError('key', null);
      if (typeof answer === 'string') throw new OpenRouterError(answer, null);
      return answer;
    },
  };
  return { asked, agent };
}

const jevSaid = (text: string, effect: AgentEffect | null = null): AgentRun => ({
  text,
  effect,
  sources: [],
});

const RUN = {
  token: 't',
  folder: '/code/app',
  name: 'app',
  expiresAt: 1,
  limitMs: 2,
  command: 'claude',
};

const runnerOffering = (offer: RunOffer): ProposalRunner & { asked: unknown[] } => {
  const asked: unknown[] = [];
  return {
    asked,
    offer: async (request) => {
      asked.push(request);
      return offer;
    },
  };
};

interface RouterOverrides extends Partial<AssistantOptions> {
  readonly runner?: ProposalRunner;
}

function router({ runner, ...overrides }: RouterOverrides) {
  return assistantRouter({
    agent: fakeAgent(null).agent,
    projects: async () => [observatory, app],
    skills: async () => SKILLS,
    where: 'local',
    proposals: proposer({ shells: ['bash'], runner: runner ?? null }),
    warn: () => undefined,
    ...overrides,
  });
}

const typed = (
  text: string,
  pick: Pick | null = null,
  history: readonly HistoryTurn[] = [],
): RouteRequest => ({ skill: null, text, pick, history });

describe('assistantRouter', () => {
  it('reports whether Jev is on, where it runs, and the skills without their prompts', async () => {
    const status = await router({ where: 'hosted' }).status();

    assert.equal(status.jev, 'off');
    assert.equal(status.where, 'hosted');
    assert.deepEqual(status.skills[0], {
      id: 'queue',
      label: 'Triage the review queue',
      description: SKILLS['queue'].description,
      project: null,
    });
  });

  it('carries out a command by keyword, with no model call', async () => {
    const { asked, agent } = fakeAgent(jevSaid('never'));

    const reply = await router({ agent }).route(typed('show the issues for observatory'));

    assert.deepEqual(reply, {
      via: 'keyword',
      tier: 1,
      action: 'show-issues',
      href: '/p/me/observatory#issues',
      says: 'Opening observatory · Issues',
      jev: 'on',
    });
    assert.deepEqual(asked, []);
  });

  it('asks which project when a part needs one and none was named', async () => {
    const reply = await router({}).route(typed('show the logs'));

    assert.equal(reply.via, 'keyword');
    assert.deepEqual('ask' in reply && reply.ask[1], {
      label: 'Logs for app',
      pick: { action: 'show-logs', project: 'app' },
    });
  });

  it('with Jev off, offers the actions the words touch and a task, and says why', async () => {
    const reply = await router({}).route(typed('how do I stop a rebase'));

    assert.deepEqual(reply, {
      via: 'keyword',
      note: 'Jev is off, so I can only match app actions.',
      question: 'Did you mean:',
      ask: [
        { label: 'Stop talking', pick: { action: 'stop', project: null } },
        { label: 'Run it as a Claude Code task', pick: { tier: 3, project: null } },
      ],
      jev: 'off',
    });
  });

  it('with Jev off on the hosted site, offers no task', async () => {
    const reply = await router({ where: 'hosted' }).route(typed('what is a rebase'));

    assert.deepEqual('ask' in reply && reply.ask, []);
    assert.equal('question' in reply && reply.question, null);
  });

  it('when Jev fails, matches keywords and says why, offering a task', async () => {
    const { agent } = fakeAgent('overloaded');

    const reply = await router({ agent }).route(typed('what is a rebase'));

    assert.equal(reply.via, 'keyword');
    assert.equal(
      'note' in reply && reply.note,
      "Jev didn't answer (OpenRouter is busy), so I matched keywords instead.",
    );
    assert.deepEqual('ask' in reply && reply.ask.map((each) => each.label), [
      'Run it as a Claude Code task',
    ]);
  });

  it('passes on a failure that is not the model’s', async () => {
    const agent: Agent = {
      isOn: true,
      by: 'x',
      answer: async () => {
        throw new TypeError('a bug');
      },
    };

    await assert.rejects(router({ agent }).route(typed('what is a rebase')), TypeError);
  });

  it('gives Jev the words, the conversation so far and the projects', async () => {
    const { asked, agent } = fakeAgent(jevSaid('It replays commits.'));
    const history: HistoryTurn[] = [
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: 'Hello.' },
    ];

    await router({ agent }).route(typed('what is a rebase', null, history));

    assert.deepEqual(asked, [{ text: 'what is a rebase', history, projects: [observatory, app] }]);
  });

  it('answers in Jev’s words, naming the model', async () => {
    const { agent } = fakeAgent(jevSaid('A rebase replays commits.'));

    const reply = await router({ agent }).route(typed('what is a rebase'));

    assert.deepEqual(reply, {
      via: 'agent',
      tier: 2,
      label: 'Jev',
      by: 'Claude Haiku',
      text: 'A rebase replays commits.',
      jev: 'on',
    });
  });

  it('opens the page Jev chose, saying what Jev said', async () => {
    const opened = {
      tier: 1,
      action: 'show-usage',
      href: '/p/me/observatory#usage',
      says: 'Opening observatory · Usage',
    } as const;
    const { agent } = fakeAgent(jevSaid('Here is your usage.', { kind: 'action', reply: opened }));

    const reply = await router({ agent }).route(typed('how much have I used'));

    assert.deepEqual(reply, { via: 'agent', ...opened, says: 'Here is your usage.', jev: 'on' });
  });

  it('runs the op Jev chose', async () => {
    const op = { tier: 1, action: 'refresh', op: 'refresh' } as const;
    const { agent } = fakeAgent(jevSaid('Refreshing.', { kind: 'action', reply: op }));

    const reply = await router({ agent }).route(typed('bring it all up to date'));

    assert.deepEqual(reply, { via: 'agent', ...op, jev: 'on' });
  });

  it('shows the task Jev proposed, with what Jev said about it', async () => {
    const proposal = {
      tier: 3,
      prompt: 'Fix the flaky test',
      command: 'claude -p "Fix the flaky test"',
      commands: [{ shell: 'bash', command: 'claude -p "Fix the flaky test"' }],
      project: 'app',
    } as const;
    const { agent } = fakeAgent(
      jevSaid('I have proposed a task; press Run.', { kind: 'proposal', proposal }),
    );

    const reply = await router({ agent }).route(typed('fix the flaky test in app'));

    assert.deepEqual(reply, {
      via: 'agent',
      ...proposal,
      text: 'I have proposed a task; press Run.',
      jev: 'on',
    });
  });

  it('marks an answer drawn from the web, with the pages it drew on', async () => {
    const sources = [{ title: 'Release notes', url: 'https://example.com/notes' }];
    const { agent } = fakeAgent({ text: 'Version 5 is out.', effect: null, sources });

    const reply = await router({ agent }).route(typed('what is new in angular'));

    assert.deepEqual(reply, {
      via: 'agent',
      tier: 2,
      label: 'Jev',
      by: 'Claude Haiku',
      text: 'Version 5 is out.',
      web: true,
      sources,
      jev: 'on',
    });
  });

  it('refuses a pick that names no such project', async () => {
    await assert.rejects(
      router({}).route(typed('x', { tier: 3, project: 'nope' })),
      (error: Error) => error instanceof BadRequest && /no such project/.test(error.message),
    );
  });

  it('turns a proposal into a run where a runner offers one', async () => {
    const runner = runnerOffering({ run: RUN });

    const reply = await router({ runner }).route(typed('go', { tier: 3, project: 'app' }));

    assert.deepEqual('run' in reply && reply.run, RUN);
    assert.deepEqual(runner.asked, [{ prompt: 'go', repo: 'me/app' }]);
  });

  it('asks which checkout when a runner offers several, and says why when it offers none', async () => {
    const several = runnerOffering({ choose: ['me/app', 'me/observatory'] });
    const none = runnerOffering({ why: 'No project has a local checkout to run it in.' });

    const asked = await router({ runner: several }).route(typed('go', { tier: 3 }));
    const refused = await router({ runner: none }).route(typed('go', { tier: 3 }));

    assert.equal('question' in asked && asked.question, 'Which project should this run in?');
    assert.deepEqual('ask' in asked && asked.ask.map((each) => each.label), ['observatory', 'app']);
    assert.equal(
      'runWhy' in refused && refused.runWhy,
      'No project has a local checkout to run it in.',
    );
  });

  it('proposes a skill in the only checkout there is without asking', async () => {
    const asked: unknown[] = [];
    const runner: ProposalRunner = {
      offer: async (request) => {
        asked.push(request.repo);
        return request.repo ? { run: RUN } : { choose: ['me/app'] };
      },
    };

    const reply = await router({ runner }).route({ skill: 'stale', pick: null });

    assert.equal(reply.via, 'skill');
    assert.equal(reply.skill, 'stale');
    assert.equal('project' in reply && reply.project, 'app');
    assert.deepEqual('run' in reply && reply.run, RUN);
    assert.deepEqual(asked, [null, 'me/app']);
  });

  it('says when a pinned skill’s project has no star map', async () => {
    const skills = async () => ({
      mine: { label: 'Mine', description: '', prompt: 'Do it.', project: 'gone' },
    });

    const reply = await router({ skills }).route({ skill: 'mine', pick: null });

    assert.deepEqual(reply, {
      via: 'skill',
      skill: 'mine',
      note: '“Mine” is for gone, which has no star map here.',
      jev: 'off',
    });
  });

  it('refuses a skill that is not in the table, an inherited name included', async () => {
    for (const skill of ['nope', 'constructor']) {
      await assert.rejects(router({}).route({ skill, pick: null }), BadRequest);
    }
  });
});
