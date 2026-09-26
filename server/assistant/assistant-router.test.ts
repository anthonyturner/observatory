import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequest } from '../http/api-handler.ts';
import { type AssistantOptions, assistantRouter } from './assistant-router.ts';
import { type FailureReason, OpenRouterError } from './open-router-error.ts';
import type { JevAnswers, OpenRouter } from './open-router.ts';
import type { Pick, Project, ProposalRunner, RouteRequest, RunOffer } from './route-contract.ts';
import { SKILLS } from './skills-table.ts';

const observatory: Project = {
  name: 'observatory',
  repo: 'me/observatory',
  href: '/p/me/observatory',
};
const app: Project = { name: 'app', repo: 'me/app', href: '/p/me/app' };

/** Models that answer as told, remembering what they were asked. */
function fakeModels(jev: JevAnswers | FailureReason | null, quick = 'An answer.') {
  const asked: string[] = [];
  const fail = (reason: FailureReason) => {
    throw new OpenRouterError(reason, null);
  };
  const models: OpenRouter = {
    isOn: jev !== null,
    quickLabel: 'Claude Haiku',
    decide: async () => {
      asked.push('jev');
      if (jev === null) return fail('key');
      return typeof jev === 'string' ? fail(jev) : jev;
    },
    answer: async () => {
      asked.push('quick');
      if (jev === null || jev === 'key') return fail('key');
      return { text: quick, isCut: false };
    },
  };
  return { asked, models };
}

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

function router(overrides: Partial<AssistantOptions>) {
  return assistantRouter({
    models: fakeModels(null).models,
    projects: async () => [observatory, app],
    skills: async () => SKILLS,
    where: 'local',
    shells: ['bash'],
    runner: null,
    warn: () => undefined,
    ...overrides,
  });
}

const typed = (text: string, pick: Pick | null = null): RouteRequest => ({
  skill: null,
  text,
  pick,
});

const jevSays = (tier: string, sure: number, action = 'none', project = 'none'): JevAnswers => ({
  tier: { choice: tier, confidence: sure },
  action: { choice: action, probabilities: { [action]: sure } },
  project: { choice: project, confidence: sure },
});

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
    const { asked, models } = fakeModels(jevSays('tier2', 1));

    const reply = await router({ models }).route(typed('show the issues for observatory'));

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

  it('when Jev fails, matches keywords and says why, offering what still works', async () => {
    const { models } = fakeModels('overloaded');

    const reply = await router({ models }).route(typed('what is a rebase'));

    assert.equal(reply.via, 'keyword');
    assert.equal(
      'note' in reply && reply.note,
      "Jev didn't answer (OpenRouter is busy), so I matched keywords instead.",
    );
    assert.deepEqual('ask' in reply && reply.ask.map((each) => each.label), [
      'A quick answer',
      'Run it as a Claude Code task',
    ]);
  });

  it('offers no quick answer when the key or the credit failed Jev', async () => {
    const { models } = fakeModels('credit');

    const reply = await router({ models }).route(typed('what is a rebase'));

    assert.deepEqual('ask' in reply && reply.ask.map((each) => each.label), [
      'Run it as a Claude Code task',
    ]);
  });

  it('acts on a sure tier-1 answer from Jev', async () => {
    const { models } = fakeModels(jevSays('tier1', 0.9, 'show-usage'));

    const reply = await router({ models }).route(typed('how much have I used'));

    assert.deepEqual(reply, {
      via: 'jev',
      confidence: 0.9,
      tier: 1,
      action: 'show-usage',
      href: '/p/me/observatory#usage',
      says: 'Opening observatory · Usage',
      jev: 'on',
    });
  });

  it('gives a quick answer on a sure tier-2 answer', async () => {
    const { models } = fakeModels(jevSays('tier2', 0.8), 'A rebase replays commits.');

    const reply = await router({ models }).route(typed('what is a rebase'));

    assert.deepEqual(reply, {
      via: 'jev',
      confidence: 0.8,
      tier: 2,
      label: 'Quick answer',
      by: 'Claude Haiku',
      text: 'A rebase replays commits.',
      jev: 'on',
    });
  });

  it('proposes a sure tier-3 answer in the project Jev named, as a command', async () => {
    const { models } = fakeModels(jevSays('tier3', 0.9, 'none', 'app'));

    const reply = await router({ models }).route(typed('fix the flaky test in app'));

    assert.deepEqual(reply, {
      via: 'jev',
      confidence: 0.9,
      tier: 3,
      prompt: 'fix the flaky test in app',
      command: 'claude -p "fix the flaky test in app"',
      commands: [{ shell: 'bash', command: 'claude -p "fix the flaky test in app"' }],
      project: 'app',
      jev: 'on',
    });
  });

  it('asks rather than acts when Jev is unsure, offering the two likeliest readings', async () => {
    const { models } = fakeModels({
      tier: { choice: 'tier1', probabilities: { tier1: 0.5, tier2: 0.3, tier3: 0.2 } },
      action: { choice: 'refresh', probabilities: { refresh: 0.9, help: 0.1 } },
    });

    const reply = await router({ models }).route(typed('bring it up to date'));

    assert.deepEqual(reply, {
      via: 'jev',
      confidence: 0.5,
      question: 'Not sure what you meant. Did you mean:',
      ask: [
        { label: 'Refresh the data from GitHub now', pick: { action: 'refresh', project: null } },
        { label: 'A quick answer', pick: { tier: 2 } },
      ],
      jev: 'on',
    });
  });

  it('says quick answers are off when there is no key and the quick answer is picked', async () => {
    const reply = await router({}).route(typed('what is a rebase', { tier: 2 }));

    assert.deepEqual(reply, {
      via: 'pick',
      tier: 2,
      failed: 'quick answers are off: there is no OpenRouter key',
      jev: 'off',
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
