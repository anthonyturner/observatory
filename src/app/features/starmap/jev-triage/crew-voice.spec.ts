import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { ASK_CHANNEL } from '../../../core/assistant/ask-channel';
import { ASK_FEED_CHANNEL, AskFeed } from '../../../core/assistant/ask-feed';
import { ASSISTANT_API, AssistantApi } from '../../../core/assistant/assistant-api';
import { RouteReply, RouteRequest } from '../../../core/assistant/assistant.types';
import { OpenQuestion } from '../../../core/assistant/open-question';
import { GRACE_MS } from '../../../core/assistant/page-jump';
import { ReplyLog } from '../../../core/assistant/reply-log';
import { CrewDispatch, NO_RUNNER_TEXT } from '../../../core/crew/crew-dispatch';
import { ProjectSnapshot } from '../../../core/projects/project.types';
import { ProjectsState } from '../../../core/projects/projects-feed';
import { PROJECTS_STATE } from '../../../core/projects/projects-source';
import { REPLY_VOICE, ReplyVoice } from '../../../core/voice/reply-voice';
import { CREW_WHICH } from './crew-voice';
import { QUEUE_CHIP } from './queue-reply';
import { REVIEW_QUEUE_SHORTCUTS } from './review-queue-shortcuts';

const WEDNESDAY = new Date(2026, 9, 7, 10, 0);
const HELLO: RouteReply = { tier: 2, text: 'Hi', ask: [], commands: [], sources: [] };
const FIX_CHECKS =
  'A crew reads the failed checks, fixes them and pushes to this branch. It never merges the pull request.';
const UPDATE_STACK =
  'The pull request this one was stacked on has merged. A crew merges that work into this branch, points the pull request where it landed and pushes. It never merges the pull request.';
const UPDATE_BRANCH =
  'A crew merges the base into this branch, resolves the conflicts and pushes. It never merges the pull request.';

const project = (name: string, pulls: readonly number[]): ProjectSnapshot => ({
  name,
  repo: `me/${name}`,
  dashboardUrl: `/p/me/${name}`,
  open: pulls.length,
  counts: { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 },
  openPulls: pulls.map((number) => ({ number, title: `Change ${number}`, closes: [] })),
});

const queueItem = (number: number, bucket: string, idleDays = 2, base = 'main') => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/x/pull/${number}`,
  bucket,
  idleDays,
  additions: 400,
  deletions: 0,
  branch: `change-${number}`,
  base,
});

/** Alpha 13 is stacked on the branch of pull request 11, which the ledger can say has merged. */
const ALPHA_ITEMS = [queueItem(12, 'failing'), queueItem(13, 'unreviewed', 9, 'change-11')];
const BASE_MERGED = [{ number: 11, head: 'change-11', base: 'main' }];
const BETA_ITEMS = [queueItem(3, 'conflicted')];

/** Send crew as Home has it, with its launch recorded rather than run. */
function fakeDispatch(isAvailable: boolean) {
  const launch = vi.fn<(repo: string, number: number) => Observable<string | null>>(() => of(null));
  const dispatch: Partial<CrewDispatch> = {
    isAvailable: signal(isAvailable).asReadonly(),
    isRunnerBusy: signal(false).asReadonly(),
    crews: signal([]).asReadonly(),
    isSending: () => false,
    availability: () => of(isAvailable),
    launch,
  };
  return { dispatch, launch };
}

function setUp(canSendCrew = true) {
  vi.setSystemTime(WEDNESDAY);
  const route = vi.fn<(request: RouteRequest) => Promise<RouteReply>>(async () => HELLO);
  const api: AssistantApi = {
    status: async () => ({ jev: 'on', where: 'local', skills: [] }),
    route,
  };
  const voice = {
    speak: vi.fn<ReplyVoice['speak']>(async () => undefined),
    stop: vi.fn(() => false),
    speaking: signal(false).asReadonly(),
  };
  const projects = [project('alpha', [12, 13]), project('beta', [3])];
  const state = signal<ProjectsState>({
    status: 'ready',
    report: { generatedAt: WEDNESDAY.toISOString(), projects, directives: [] },
  });
  const { dispatch, launch } = fakeDispatch(canSendCrew);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      ASK_FEED_CHANNEL,
      REVIEW_QUEUE_SHORTCUTS,
      { provide: CrewDispatch, useValue: dispatch },
      { provide: ASSISTANT_API, useValue: api },
      { provide: REPLY_VOICE, useValue: voice },
      { provide: PROJECTS_STATE, useValue: state.asReadonly() },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const http = TestBed.inject(HttpTestingController);
  const log = TestBed.inject(ReplyLog);
  const channel = TestBed.inject(ASK_CHANNEL);
  const question = TestBed.inject(OpenQuestion);
  question.panelArrived();
  const reply = (repo: 'alpha' | 'beta') => ({
    generatedAt: 'x',
    repo: `me/${repo}`,
    items: repo === 'alpha' ? ALPHA_ITEMS : BETA_ITEMS,
  });
  const flush = (repo: 'alpha' | 'beta'): void => {
    http.expectOne(`/api/queue?repo=me/${repo}`).flush(reply(repo));
  };
  /** Answers a queue read made once its feature has loaded. */
  const read = async (repo: 'alpha' | 'beta'): Promise<void> => {
    const asked = await vi.waitFor(() => http.expectOne(`/api/queue?repo=me/${repo}`));
    asked.flush(reply(repo));
  };
  return {
    async type(words: string): Promise<void> {
      channel.submit(words);
      await vi.dynamicImportSettled();
    },
    async say(words: string): Promise<void> {
      channel.submit(words, { spoken: true });
      await vi.dynamicImportSettled();
    },
    latest: () => log.entries()[0],
    feed: TestBed.inject(AskFeed),
    question,
    route,
    voice,
    navigate,
    http,
    launch,
    read,
    /** Answers the queue and ledger reads a crew's check makes, once Send crew has loaded. */
    async checked(repo: 'alpha' | 'beta', mergedBranches: readonly object[] = []): Promise<void> {
      await read(repo);
      const ledger = { generatedAt: 'x', rows: [], titles: {}, finished: [], mergedBranches };
      http.expectOne(`/api/ledger?repo=me/${repo}`).flush(ledger);
    },
    /** "What's blocking?", read: beta 3 conflicted, alpha 12 failing, alpha 13 waiting. */
    async listBlocking(): Promise<void> {
      channel.submit('what’s blocking?');
      await vi.dynamicImportSettled();
      flush('alpha');
      flush('beta');
    },
  };
}

describe('sending a crew by voice or typing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('takes a spoken reply naming one from the blocking list, and sends on a yes', async () => {
    const { listBlocking, say, type, latest, checked, question, voice, launch, route } = setUp();
    await listBlocking();

    await say('the beta one about change 3, assign it to a crew member');
    expect(latest()).toEqual(expect.objectContaining({ how: 'spoken', chip: QUEUE_CHIP }));
    expect(latest().said.text).toBe('Checking it…');
    expect(question.question()).toBeNull();
    await checked('beta');

    const asked = `Send a crew to beta pull request 3, “Change 3”? ${UPDATE_BRANCH}`;
    expect(latest().said.text).toBe(asked);
    expect(voice.speak).toHaveBeenCalledWith(asked, 1);
    expect(latest().actions).toEqual([
      { kind: 'say', label: 'Yes', words: 'yes' },
      { kind: 'say', label: 'No', words: 'no' },
    ]);
    expect(launch).not.toHaveBeenCalled();

    await type('yes');

    expect(launch).toHaveBeenCalledExactlyOnceWith('me/beta', 3);
    expect(latest().said.text).toBe(
      'Crew sent to beta pull request 3, “Change 3”. Its ship stays by the star while it works, and the task panel has its log.',
    );
    expect(route).not.toHaveBeenCalled();
  });

  it('takes a place on the list, and the Yes button', async () => {
    const { listBlocking, type, latest, checked, feed, launch } = setUp();
    await listBlocking();

    await type('send a crew to number two');
    await checked('alpha');
    feed.press(latest().id, latest().actions[0]);

    expect(launch).toHaveBeenCalledExactlyOnceWith('me/alpha', 12);
  });

  it('sends nothing on a no', async () => {
    const { listBlocking, type, say, latest, checked, launch } = setUp();
    await listBlocking();

    await type('get a crew on the second one');
    await checked('alpha');
    await say('no');

    expect(latest().said.text).toBe('Left it.');
    expect(launch).not.toHaveBeenCalled();
  });

  it('checks and asks before a crew Jev chose, sending nothing without a yes', async () => {
    const { type, latest, checked, route, launch } = setUp();
    route.mockResolvedValueOnce({
      via: 'agent',
      tier: 1,
      queue: { kind: 'crew', repo: 'me/alpha', pr: 12 },
      ask: [],
      commands: [],
    });

    await type('could you have someone sort out the failing checks on twelve');
    await vi.waitFor(() => expect(latest().said.text).toBe('Checking it…'));
    await checked('alpha');

    expect(latest().said.text).toBe(
      `Send a crew to alpha pull request 12, “Change 12”? ${FIX_CHECKS}`,
    );
    expect(launch).not.toHaveBeenCalled();
  });

  it('works on its own, with no list first', async () => {
    const { type, latest, checked } = setUp();

    await type('send a crew to 12');
    await checked('alpha');

    expect(latest().said.text).toBe(
      `Send a crew to alpha pull request 12, “Change 12”? ${FIX_CHECKS}`,
    );
  });

  it('offers to open one a crew cannot take, and opens it on a yes', async () => {
    const { listBlocking, type, latest, checked, launch, navigate } = setUp();
    await listBlocking();

    await type('send a crew to the third one');
    await checked('alpha');
    expect(latest().said.text).toBe(
      'A crew only takes a pull request that is failing, conflicted or stacked on a base that has merged, and this one isn’t: waiting on you, idle 9 days. Want me to open alpha pull request 13, “Change 13” instead?',
    );

    await type('yes');
    await vi.advanceTimersByTimeAsync(GRACE_MS);

    expect(launch).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/p/me/alpha?pr=13');
  });

  it('sends one to a pull request whose stacked base has merged, as the star card does', async () => {
    const { listBlocking, type, latest, checked, launch } = setUp();
    await listBlocking();

    await type('send a crew to the third one');
    await checked('alpha', BASE_MERGED);
    expect(latest().said.text).toBe(
      `Send a crew to alpha pull request 13, “Change 13”? ${UPDATE_STACK}`,
    );

    await type('yes');

    expect(launch).toHaveBeenCalledExactlyOnceWith('me/alpha', 13);
  });

  it('asks which, naming them, and takes the next reply as the crew’s pick', async () => {
    const { listBlocking, say, latest, checked, question } = setUp();
    await listBlocking();

    await say('send a crew to the alpha one');
    expect(latest().said.text).toBe(
      'Which one: alpha pull request 12 (“Change 12”) or alpha pull request 13 (“Change 13”)?',
    );
    expect(question.question()?.words).toBe(CREW_WHICH);

    await say('the first one');
    await checked('alpha');

    expect(latest().said.text).toMatch(/^Send a crew to alpha pull request 12/);
  });

  it('opens one named with “open” while asking which the crew takes', async () => {
    const { listBlocking, say, latest, navigate, launch } = setUp();
    await listBlocking();
    await say('send a crew to the alpha one');

    await say('open the second one');
    await vi.advanceTimersByTimeAsync(GRACE_MS);

    expect(latest().said.text).toBe('Opening pull request 13 in alpha…');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/p/me/alpha?pr=13');
    expect(launch).not.toHaveBeenCalled();
  });

  it('takes a no to “which one?” as a no, even with one to choose from', async () => {
    const { type, say, latest, read, http, question } = setUp();
    await type('what’s blocking in beta');
    await read('beta');
    await say('send a crew to number 999');
    expect(latest().said.text).toBe(
      'I can’t tell which one that is. Is it beta pull request 3 (“Change 3”)?',
    );

    await say('no');

    expect(latest().said.text).toBe('Left it.');
    expect(question.question()).toBeNull();
    http.expectNone('/api/queue?repo=me/beta');
  });

  it('names every open one when none is named and there are few', async () => {
    const { type, latest, http, question } = setUp();

    await type('send a crew please');

    expect(latest().said.text).toBe(
      'Which one: alpha pull request 12 (“Change 12”), alpha pull request 13 (“Change 13”) or beta pull request 3 (“Change 3”)?',
    );
    expect(question.question()?.items).toHaveLength(3);
    http.expectNone('/api/queue?repo=me/alpha');
  });

  it('says so where no crew can launch, reading nothing', async () => {
    const { type, latest, http } = setUp(false);

    await type('send a crew to 12');

    await vi.waitFor(() => expect(latest().said.text).toBe(NO_RUNNER_TEXT));
    http.expectNone('/api/queue?repo=me/alpha');
  });

  it('says why when the crew does not launch', async () => {
    const { type, latest, checked, launch } = setUp();
    launch.mockReturnValue(of('Another task started first. Send the crew once it ends.'));

    await type('send a crew to 12');
    await checked('alpha');
    await type('yes');

    expect(latest().said.text).toBe('Another task started first. Send the crew once it ends.');
  });

  it('leaves words that name no pull request to the router', async () => {
    const { type, route } = setUp();

    await type('send a crew to the flux capacitor');

    await vi.waitFor(() => expect(route).toHaveBeenCalled());
  });
});
