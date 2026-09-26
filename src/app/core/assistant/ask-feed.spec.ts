import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { PAGE_REFRESH, PageRefresh } from '../projects/projects-refresh';
import { HelpState } from '../../shared/help/help-state';
import { REPLY_VOICE, ReplyVoice } from '../voice/reply-voice';
import { ASK_CHANNEL } from './ask-channel';
import { ASK_FEED_CHANNEL, AskFeed } from './ask-feed';
import { ASSISTANT_API, AssistantApi, AssistantRefused } from './assistant-api';
import { AssistantInfo } from './assistant-info';
import { RouteReply, RouteRequest } from './assistant.types';
import { GRACE_MS, JUMP_WAIT_MS } from './page-jump';
import { ProposalSlot } from './proposal';
import { ReplyLog } from './reply-log';

const reply = (fields: Partial<RouteReply>): RouteReply => ({ ask: [], commands: [], ...fields });

const OPEN_ISSUES = reply({
  via: 'keyword',
  tier: 1,
  action: 'show-issues',
  href: '/p/me/app#issues',
  says: 'Opening app · Issues',
});

function setUp(answers: ((request: RouteRequest) => Promise<RouteReply>)[] = []) {
  const route = vi.fn<(request: RouteRequest) => Promise<RouteReply>>();
  for (const answer of answers) route.mockImplementationOnce(answer);
  const api: AssistantApi = {
    status: async () => ({ jev: 'on', where: 'local', skills: [] }),
    route,
  };
  const speaking = signal(false);
  const voice = {
    speak: vi.fn<ReplyVoice['speak']>(async () => undefined),
    stop: vi.fn(() => false),
    speaking: speaking.asReadonly(),
  };
  const refresh: PageRefresh = { refresh: vi.fn(async () => 'done' as const) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      ASK_FEED_CHANNEL,
      { provide: ASSISTANT_API, useValue: api },
      { provide: REPLY_VOICE, useValue: voice },
      { provide: PAGE_REFRESH, useValue: refresh },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const feed = TestBed.inject(AskFeed);
  const log = TestBed.inject(ReplyLog);
  const latest = () => log.entries()[0];
  return { feed, log, latest, route, voice, speaking, navigate, refresh };
}

const answer = (value: RouteReply) => async () => value;
const settle = () => vi.advanceTimersByTimeAsync(0);

describe('AskFeed', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('takes a request from the channel, waits on the router, then shows its reply', async () => {
    const { feed, latest, route } = setUp([answer(reply({ via: 'keyword', tier: 1, op: 'help' }))]);

    TestBed.inject(ASK_CHANNEL).submit('  help  ', { spoken: true });

    expect(route).toHaveBeenCalledWith({ text: 'help' });
    expect(feed.busy()).toBe(true);
    expect(latest()).toEqual(
      expect.objectContaining({
        asked: 'help',
        how: 'spoken',
        chip: expect.objectContaining({ tone: 'wait' }),
      }),
    );

    await settle();

    expect(feed.busy()).toBe(false);
    expect(latest().chip.text).toMatch(/^Tier 1 · Action · keyword · \d+ ms$/);
    expect(latest().said.text).toBe('Opened the help card.');
    expect(TestBed.inject(HelpState).isOpen()).toBe(true);
  });

  it('sends nothing blank, and nothing while a request is on its way', async () => {
    const { feed, route } = setUp([() => new Promise(() => undefined)]);

    feed.submit('   ');
    feed.submit('one');
    feed.submit('two');
    await settle();

    expect(route).toHaveBeenCalledTimes(1);
  });

  it('opens a page after the grace second, saying so as it goes', async () => {
    const { feed, latest, navigate, voice } = setUp([answer(OPEN_ISSUES)]);

    feed.submit('issues for app');
    await settle();

    expect(latest().said.text).toBe('Opening app · Issues…');
    expect(latest().actions).toEqual([{ kind: 'stay' }]);
    expect(voice.speak).toHaveBeenCalledWith('Opening app · Issues…', 1);
    expect(feed.hasPendingJump()).toBe(true);

    await vi.advanceTimersByTimeAsync(GRACE_MS);

    expect(navigate).toHaveBeenCalledWith('/p/me/app#issues');
    expect(feed.hasPendingJump()).toBe(false);
  });

  it('stays here when asked, leaving a link to go after all', async () => {
    const { feed, latest, navigate } = setUp([answer(OPEN_ISSUES)]);
    feed.submit('issues for app');
    await settle();

    feed.press(latest().id, { kind: 'stay' });
    await vi.advanceTimersByTimeAsync(GRACE_MS * 2);

    expect(navigate).not.toHaveBeenCalled();
    expect(latest().said).toEqual(
      expect.objectContaining({
        text: 'Stayed here. ',
        isNote: true,
        openHref: '/p/me/app#issues',
      }),
    );
    expect(latest().actions).toEqual([]);
  });

  it('waits for the spoken line before jumping, but not for ever', async () => {
    const { feed, navigate, voice } = setUp([answer(OPEN_ISSUES), answer(OPEN_ISSUES)]);
    let heard = (): void => undefined;
    voice.speak.mockImplementationOnce(() => new Promise<void>((resolve) => (heard = resolve)));
    voice.speak.mockImplementationOnce(() => new Promise<void>(() => undefined));

    feed.submit('issues for app');
    await vi.advanceTimersByTimeAsync(GRACE_MS * 2);
    expect(navigate).not.toHaveBeenCalled();
    heard();
    await settle();
    expect(navigate).toHaveBeenCalledTimes(1);

    feed.submit('issues for app');
    await vi.advanceTimersByTimeAsync(GRACE_MS + JUMP_WAIT_MS - 1);
    expect(navigate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('says so rather than jumping to the page already open', async () => {
    const { feed, latest, navigate } = setUp([
      answer(reply({ tier: 1, href: '/', says: 'Opening Home' })),
    ]);

    feed.submit('home');
    await settle();
    await vi.advanceTimersByTimeAsync(GRACE_MS);

    expect(latest().said.text).toBe('You’re on Home already.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('offers Did-you-mean options, sending the same words with the one picked', async () => {
    const pick = { action: 'show-logs', project: 'app' };
    const { feed, latest, route } = setUp([
      answer(
        reply({
          via: 'jev',
          note: undefined,
          question: 'Not sure. Did you mean:',
          ask: [{ label: 'Open app · Logs', pick }],
        }),
      ),
      answer(reply({ via: 'pick', tier: 1, op: 'help' })),
    ]);
    feed.submit('logz');
    await settle();

    expect(latest().said).toEqual(
      expect.objectContaining({ text: 'Not sure. Did you mean:', isNote: true }),
    );
    const [option, neither] = latest().actions;
    expect(neither).toEqual({ kind: 'neither' });

    feed.press(latest().id, option);
    await settle();

    expect(route).toHaveBeenLastCalledWith({ text: 'logz', pick });
    expect(latest().said.text).toBe('Opened the help card.');
  });

  it('leaves the options on Neither', async () => {
    const { feed, latest } = setUp([
      answer(
        reply({ question: 'Did you mean:', ask: [{ label: 'A quick answer', pick: { tier: 2 } }] }),
      ),
    ]);
    feed.submit('hmm');
    await settle();

    feed.press(latest().id, { kind: 'neither' });

    expect(latest().actions).toEqual([]);
    expect(latest().said.text).toBe('Left it.');
  });

  it('shows a quick answer to copy, and reads it aloud', async () => {
    const { feed, latest, voice } = setUp([answer(reply({ tier: 2, text: 'Use `git rebase`.' }))]);

    feed.submit('how do I rebase');
    await settle();

    expect(latest().said).toEqual(
      expect.objectContaining({ text: 'Use `git rebase`.', isAnswer: true }),
    );
    expect(voice.speak).toHaveBeenCalledWith('Use `git rebase`.', 2);
  });

  it('says why a quick answer failed, with Try again as a quick answer', async () => {
    const { feed, latest } = setUp([answer(reply({ tier: 2, failed: 'there is no key' }))]);

    feed.submit('why');
    await settle();

    expect(latest().said.text).toBe('Couldn’t get a quick answer: there is no key.');
    expect(latest().actions).toEqual([
      { kind: 'send', label: 'Try again', request: { text: 'why', pick: { tier: 2 } } },
    ]);
  });

  it('puts a task up as a proposal, and never reads it aloud', async () => {
    const { feed, latest, voice } = setUp([
      answer(
        reply({
          tier: 3,
          project: 'app',
          commands: [{ shell: 'PowerShell', command: "claude -p 'fix it'" }],
        }),
      ),
    ]);

    feed.submit('fix the build');
    await settle();

    expect(latest().said.text).toBe('Proposed a task: see above.');
    expect(voice.speak).not.toHaveBeenCalled();
    expect(TestBed.inject(ProposalSlot).proposal()).toEqual(
      expect.objectContaining({
        kind: 'command',
        intro: 'In your app folder, run:',
        writtenFor: 'Written for PowerShell; not for cmd.exe.',
      }),
    );

    feed.dismissProposal();
    expect(TestBed.inject(ProposalSlot).proposal()).toBeNull();
  });

  describe('a task the local site can run', () => {
    const RUNNABLE = reply({
      tier: 3,
      project: 'app',
      prompt: 'fix the build',
      commands: [{ shell: 'PowerShell', command: "claude -p 'fix the build'" }],
      run: {
        token: 't0k',
        folder: 'E:\\repos\\app',
        name: 'app',
        expiresAt: Date.now() + 5 * 60_000,
        limitMs: 30 * 60_000,
        command: 'claude -p --output-format stream-json --verbose',
      },
    });

    it('proposes to run it here: the prompt, the folder and the terms', async () => {
      const { feed, latest } = setUp([answer(RUNNABLE)]);

      feed.submit('fix the build');
      await settle();

      expect(TestBed.inject(ProposalSlot).proposal()).toEqual(
        expect.objectContaining({
          kind: 'run',
          entryId: latest().id,
          prompt: 'fix the build',
          project: 'app',
          where: 'app · E:\\repos\\app',
          terms: expect.stringMatching(/stops after 30 minutes\. Valid for [45] minutes\.$/),
        }),
      );
    });

    it('says Left it on its reply when cancelled', async () => {
      const { feed, latest } = setUp([answer(RUNNABLE)]);
      feed.submit('fix the build');
      await settle();

      feed.leaveProposal(latest().id);

      expect(latest().said.text).toBe('Left it.');
      expect(TestBed.inject(ProposalSlot).proposal()).toBeNull();
    });

    it('proposes it again into the same reply, in the same project', async () => {
      const { feed, latest, route } = setUp([answer(RUNNABLE), answer(RUNNABLE)]);
      feed.submit('fix the build');
      await settle();
      const proposal = TestBed.inject(ProposalSlot).proposal();
      if (proposal?.kind !== 'run') throw new Error('no proposal to run');

      feed.proposeAgain(proposal);
      await settle();

      expect(route).toHaveBeenLastCalledWith({
        text: 'fix the build',
        pick: { tier: 3, project: 'app' },
      });
      expect(TestBed.inject(ProposalSlot).proposal()?.id).not.toBe(proposal.id);
      expect(latest().id).toBe(proposal.entryId);
    });
  });

  it('refreshes, saying how it went', async () => {
    const { feed, latest, refresh } = setUp([answer(reply({ tier: 1, op: 'refresh' }))]);

    feed.submit('refresh');
    await settle();

    expect(refresh.refresh).toHaveBeenCalled();
    expect(latest().said.text).toBe('Refreshed every project.');
  });

  it('stops speaking on "stop", saying whether anything was', async () => {
    const { feed, latest, voice } = setUp([answer(reply({ tier: 1, op: 'stop' }))]);
    voice.stop.mockReturnValueOnce(true);

    feed.submit('stop');
    await settle();

    expect(latest().said.text).toBe('Stopped speaking.');
    expect(voice.speak).not.toHaveBeenCalled();
  });

  it('says the site did not answer, with Try again sending the same request', async () => {
    const { feed, latest, route } = setUp([
      () => Promise.reject(new Error('offline')),
      answer(reply({ tier: 1, op: 'help' })),
    ]);
    feed.submit('help');
    await settle();

    expect(latest().chip).toEqual(expect.objectContaining({ text: 'No answer', tone: 'bad' }));
    expect(latest().said.text).toBe('The site didn’t answer.');

    feed.press(latest().id, latest().actions[0]);
    await settle();

    expect(route).toHaveBeenLastCalledWith({ text: 'help' });
    expect(latest().said.text).toBe('Opened the help card.');
  });

  it('takes a refusal as no assistant here, not as a failure', async () => {
    const { feed, latest } = setUp([() => Promise.reject(new AssistantRefused('visitor'))]);

    feed.submit('help');
    await settle();

    expect(TestBed.inject(AssistantInfo).isRefused()).toBe(true);
    expect(latest().actions).toEqual([]);
  });

  it('proposes a skill by its id alone, under its label', async () => {
    const { feed, latest, route } = setUp([
      answer(
        reply({ via: 'skill', tier: 3, commands: [{ shell: 'bash', command: 'claude -p x' }] }),
      ),
    ]);

    feed.pressSkill({ id: 'stale', label: 'Find stale PRs' });

    expect(route).toHaveBeenCalledWith({ skill: 'stale' });
    expect(feed.pressedSkill()).toBe('stale');
    expect(latest()).toEqual(expect.objectContaining({ asked: 'Find stale PRs', how: 'skill' }));
    await settle();
    expect(feed.pressedSkill()).toBeNull();
  });

  it('notes Jev’s state from every reply', async () => {
    const { feed } = setUp([answer(reply({ jev: 'off', via: 'keyword', note: 'Jev is off.' }))]);

    feed.submit('something odd');
    await settle();

    expect(TestBed.inject(AssistantInfo).jev()).toBe('off');
  });
});
