import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { QueueItem, QueueReport } from '../../queue/queue-report.ts';
import type { AgentTool, ToolArgs, ToolContext } from '../agent/agent-tool.ts';
import { queueTools } from './queue-tools.ts';
import { snoozeSpanUntil } from './snooze-date.ts';
import { ToolArgError } from './tool-args.ts';

/** A Wednesday morning. */
const TODAY = new Date(2026, 9, 7, 10, 0);

const context: ToolContext = {
  projects: [
    { name: 'app', repo: 'me/app', href: '/p/me/app' },
    { name: 'site', repo: 'me/site', href: '/p/me/site' },
  ],
};

const item = (number: number): QueueItem => ({
  number,
  title: `Pull ${number}`,
  url: '',
  isDraft: false,
  bucket: 'failing',
  closes: [],
  failingChecks: 1,
  flakyChecks: [],
  additions: 1,
  deletions: 1,
  updatedAt: '',
  branch: '',
  headSha: 'a'.repeat(40),
  base: 'main',
  mergeable: 'MERGEABLE',
  changedFiles: 1,
  idleDays: 4,
  ageDays: 9,
});

/** The tools over a queue holding 412 in every project, remembering each repository read. */
function setUp() {
  const read: string[] = [];
  const queue = async (repo: string): Promise<QueueReport> => {
    read.push(repo);
    return { generatedAt: '', repo, items: [item(412)] };
  };
  const tools = queueTools(queue, () => TODAY);
  const tool = (name: string): AgentTool => {
    const found = tools.find((each) => each.name === name);
    if (!found) throw new Error(`no tool ${name}`);
    return found;
  };
  const run = (name: string, args: ToolArgs) => tool(name).run(args, context);
  return { read, run, names: tools.map((each) => each.name) };
}

const refusedWith = (message: RegExp) => (error: Error) =>
  error instanceof ToolArgError && message.test(error.message);

describe('queueTools', () => {
  it('offers what’s blocking, open, snooze, dismiss and send crew', () => {
    assert.deepEqual(setUp().names, [
      'whats_blocking',
      'open_pull_request',
      'snooze_pull_request',
      'dismiss_pull_request',
      'send_crew',
    ]);
  });

  it('hands the page what’s blocking, in every project or one', async () => {
    const { run } = setUp();

    assert.deepEqual((await run('whats_blocking', {})).effect, {
      kind: 'queue',
      act: { kind: 'blocking', repo: null },
    });
    assert.deepEqual((await run('whats_blocking', { project: 'site' })).effect, {
      kind: 'queue',
      act: { kind: 'blocking', repo: 'me/site' },
    });
  });

  it('hands the page a dismissal or a crew to ask about, and changes nothing', async () => {
    const { run } = setUp();

    const dismissed = await run('dismiss_pull_request', { project: 'app', number: 412 });
    const crewed = await run('send_crew', { project: 'me/app', number: '412' });

    assert.deepEqual(dismissed.effect, {
      kind: 'queue',
      act: { kind: 'dismiss', repo: 'me/app', pr: 412 },
    });
    assert.deepEqual(crewed.effect, {
      kind: 'queue',
      act: { kind: 'crew', repo: 'me/app', pr: 412 },
    });
    assert.deepEqual(dismissed.content, {
      pullRequest: 'app pull request 412',
      note: 'Nothing has changed yet: the page asks the owner yes or no first, so do not say it is done.',
    });
  });

  it('hands the page a pull request to open', async () => {
    const { run } = setUp();

    const opened = await run('open_pull_request', { project: 'site', number: 412 });

    assert.deepEqual(opened.effect, {
      kind: 'queue',
      act: { kind: 'open', repo: 'me/site', pr: 412 },
    });
  });

  it('hands the page a snooze till the date named, counted in days', async () => {
    const { run } = setUp();

    const snoozed = await run('snooze_pull_request', {
      project: 'app',
      number: 412,
      until: '2026-10-12',
    });

    assert.deepEqual(snoozed.effect, {
      kind: 'queue',
      act: { kind: 'snooze', repo: 'me/app', pr: 412, days: 5, words: 'till Monday 12 October' },
    });
  });

  it('tells the model when the pull request is not open, or the arguments are wrong', async () => {
    const { run, read } = setUp();

    await assert.rejects(
      run('dismiss_pull_request', { project: 'app', number: 99 }),
      refusedWith(/app has no open pull request 99; project_pull_requests lists them/),
    );
    assert.deepEqual(read, ['me/app']);
    await assert.rejects(
      run('send_crew', { project: 'nowhere', number: 412 }),
      refusedWith(/No project called nowhere/),
    );
    await assert.rejects(
      run('dismiss_pull_request', { project: 'app', number: 4.5 }),
      refusedWith(/number must be a whole number/),
    );
    await assert.rejects(
      run('snooze_pull_request', { project: 'app', number: 412 }),
      refusedWith(/until is required/),
    );
  });
});

describe('snoozeSpanUntil', () => {
  it('counts whole days to the date, and says it', () => {
    assert.deepEqual(snoozeSpanUntil('2026-10-08', TODAY), {
      days: 1,
      words: 'till Thursday 8 October',
    });
    assert.deepEqual(snoozeSpanUntil('2027-01-05', TODAY), {
      days: 90,
      words: 'till Tuesday 5 January',
    });
  });

  it('refuses a date that is no date, not ahead, or too far', () => {
    for (const until of ['Monday', '2026-02-30', '2026-10-07', '2026-10-01', '2027-01-06']) {
      assert.throws(() => snoozeSpanUntil(until, TODAY), ToolArgError, until);
    }
  });
});
