import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ASK_CHANNEL } from '../../../core/assistant/ask-channel';
import { ASK_FEED_CHANNEL, AskFeed } from '../../../core/assistant/ask-feed';
import { ASSISTANT_API, AssistantApi } from '../../../core/assistant/assistant-api';
import { AssistantInfo } from '../../../core/assistant/assistant-info';
import { RouteReply, RouteRequest } from '../../../core/assistant/assistant.types';
import { OpenQuestion, QUESTION_MS, TIMED_OUT_NOTE } from '../../../core/assistant/open-question';
import { GRACE_MS } from '../../../core/assistant/page-jump';
import { ReplyLog } from '../../../core/assistant/reply-log';
import { ProjectSnapshot } from '../../../core/projects/project.types';
import { ProjectsState } from '../../../core/projects/projects-feed';
import { PROJECTS_STATE } from '../../../core/projects/projects-source';
import { REPLY_VOICE, ReplyVoice } from '../../../core/voice/reply-voice';
import { OUT_OF_REACH, QUEUE_CHIP } from './queue-reply';
import { REVIEW_QUEUE_SHORTCUTS } from './review-queue-shortcuts';

/** A Wednesday, so “till Monday” is five days. */
const WEDNESDAY = new Date(2026, 9, 7, 10, 0);
const HELLO: RouteReply = { tier: 2, text: 'Hi', ask: [], commands: [], sources: [] };

const project = (name: string, pulls: readonly number[]): ProjectSnapshot => ({
  name,
  repo: `me/${name}`,
  dashboardUrl: `/p/me/${name}`,
  open: pulls.length,
  counts: { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 },
  openPulls: pulls.map((number) => ({ number, title: `Change ${number}`, closes: [] })),
});

const queueItem = (number: number, bucket: string, idleDays = 2) => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/x/pull/${number}`,
  bucket,
  idleDays,
  additions: 400,
  deletions: 0,
});

function setUp(
  projects: readonly ProjectSnapshot[] = [project('alpha', [12, 13]), project('beta', [3])],
) {
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
  const state = signal<ProjectsState>({
    status: 'ready',
    report: { generatedAt: WEDNESDAY.toISOString(), projects, directives: [] },
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      ASK_FEED_CHANNEL,
      REVIEW_QUEUE_SHORTCUTS,
      { provide: ASSISTANT_API, useValue: api },
      { provide: REPLY_VOICE, useValue: voice },
      { provide: PROJECTS_STATE, useValue: state.asReadonly() },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const http = TestBed.inject(HttpTestingController);
  const log = TestBed.inject(ReplyLog);
  const channel = TestBed.inject(ASK_CHANNEL);
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
    entry: (id: number) => log.find(id),
    feed: TestBed.inject(AskFeed),
    question: TestBed.inject(OpenQuestion),
    info: TestBed.inject(AssistantInfo),
    route,
    voice,
    navigate,
    http,
    flushQueues(): void {
      http.expectOne('/api/queue?repo=me/alpha').flush({
        generatedAt: 'x',
        repo: 'me/alpha',
        items: [queueItem(12, 'failing'), queueItem(13, 'unreviewed', 9)],
      });
      http
        .expectOne('/api/queue?repo=me/beta')
        .flush({ generatedAt: 'x', repo: 'me/beta', items: [queueItem(3, 'conflicted')] });
    },
  };
}

const BLOCKING_LINE =
  'The top 3, blocked first. ' +
  '1: beta pull request 3, “Change 3”: cannot merge, idle 2 days. ' +
  '2: alpha pull request 12, “Change 12”: checks failing, idle 2 days. ' +
  '3: alpha pull request 13, “Change 13”: waiting on you, idle 9 days.';

describe('the Review Queue by voice or typing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reads out the top three, blocked first, with no router or model', async () => {
    const { type, latest, flushQueues, route, voice } = setUp();

    await type('What’s blocking?');
    expect(latest().said.text).toBe('Reading the queues…');
    flushQueues();

    expect(latest()).toEqual(
      expect.objectContaining({ asked: 'What’s blocking?', how: 'typed', chip: QUEUE_CHIP }),
    );
    expect(latest().said.text).toBe(BLOCKING_LINE);
    expect(voice.speak).toHaveBeenCalledWith(BLOCKING_LINE, 1);
    expect(route).not.toHaveBeenCalled();
  });

  describe('with Home’s Ask panel on screen', () => {
    const OFFER = 'Want to work on one? I can open it or send a crew.';

    it('ends the list with an offer, keeping the three as the question’s items', async () => {
      const { type, latest, flushQueues, question, voice } = setUp();
      question.panelArrived();

      await type('what’s blocking?');
      flushQueues();

      expect(latest().said.text).toBe(`${BLOCKING_LINE} ${OFFER}`);
      expect(voice.speak).toHaveBeenCalledWith(`${BLOCKING_LINE} ${OFFER}`, 1);
      expect(question.question()?.words).toBe(OFFER);
      expect(question.question()?.items.map(({ repo, number }) => `${repo}#${number}`)).toEqual([
        'me/beta#3',
        'me/alpha#12',
        'me/alpha#13',
      ]);
    });

    it('opens one named in a typed reply, as a spoken one would', async () => {
      const { type, latest, flushQueues, question, navigate } = setUp();
      question.panelArrived();
      await type('what’s blocking?');
      flushQueues();

      await type('open the alpha one about change 13');

      expect(latest().how).toBe('typed');
      expect(latest().said.text).toBe('Opening pull request 13 in alpha…');
      await vi.advanceTimersByTimeAsync(GRACE_MS);
      expect(navigate).toHaveBeenCalledExactlyOnceWith('/p/me/alpha?pr=13');
    });

    it('offers nothing when nothing is waiting', async () => {
      const { type, latest, http, question } = setUp([project('beta', [3])]);
      question.panelArrived();

      await type('what’s blocking?');
      http
        .expectOne('/api/queue?repo=me/beta')
        .flush({ generatedAt: 'x', repo: 'me/beta', items: [] });

      expect(latest().said.text).toMatch(/^Nothing is waiting/);
      expect(question.question()).toBeNull();
    });
  });

  it('answers spoken words exactly as typed ones', async () => {
    const { say, latest, flushQueues } = setUp();

    await say('what is blocked');
    flushQueues();

    expect(latest().how).toBe('spoken');
    expect(latest().said.text).toBe(BLOCKING_LINE);
  });

  it('reads only the project named', async () => {
    const { type, latest, http } = setUp();

    await type('what’s blocking in beta');
    http
      .expectOne('/api/queue?repo=me/beta')
      .flush({ generatedAt: 'x', repo: 'me/beta', items: [queueItem(3, 'conflicted')] });

    http.expectNone('/api/queue?repo=me/alpha');
    expect(latest().said.text).toContain('Only 1 pull request to work');
  });

  it('opens Next star’s pick after the grace second, with Stay here', async () => {
    const { type, latest, flushQueues, navigate } = setUp();

    await type('next star');
    flushQueues();

    expect(latest().said.text).toBe(
      'Next star: beta pull request 3, “Change 3”, cannot merge, idle 2 days. Opening it…',
    );
    expect(latest().actions).toEqual([{ kind: 'stay' }]);
    await vi.advanceTimersByTimeAsync(GRACE_MS);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/p/me/beta?pr=3');
  });

  it('asks before snoozing, and snoozes only on a yes', async () => {
    const { type, latest, http, voice } = setUp();

    await type('snooze 12 till Monday');
    const asked = latest();
    expect(asked.said.text).toBe('Snooze alpha pull request 12, “Change 12”, till Monday?');
    expect(voice.speak).toHaveBeenCalledWith(asked.said.text, 1);
    expect(asked.actions).toEqual([
      { kind: 'say', label: 'Yes', words: 'yes' },
      { kind: 'say', label: 'No', words: 'no' },
    ]);
    http.expectNone('/api/triage');

    await type('yes');
    const post = http.expectOne('/api/triage');
    expect(post.request.body).toEqual({ repo: 'me/alpha', number: 12, action: 'snooze', days: 5 });
    post.flush({ number: 12, isSeen: false, hidden: null, lookedSha: null });

    expect(latest().said.text).toBe('Snoozed alpha pull request 12, “Change 12”, till Monday.');
  });

  it('takes the Yes button as a typed yes', async () => {
    const { type, latest, http, feed } = setUp();

    await type('dismiss 3');
    const asked = latest();
    feed.press(asked.id, asked.actions[0]);

    const post = http.expectOne('/api/triage');
    expect(post.request.body).toEqual({ repo: 'me/beta', number: 3, action: 'dismiss' });
    expect(latest().asked).toBe('yes');
  });

  it('leaves it on a spoken no, recording nothing', async () => {
    const { type, say, latest, entry, http } = setUp();

    await type('dismiss 3');
    const askedId = latest().id;
    await say('no thanks');

    http.expectNone('/api/triage');
    expect(latest().said.text).toBe('Left it.');
    expect(entry(askedId)?.actions).toEqual([]);
  });

  it('says so when the API does not take it', async () => {
    const { type, latest, http } = setUp();

    await type('dismiss 3');
    await type('yes');
    http.expectOne('/api/triage').flush('no', { status: 500, statusText: 'Server Error' });

    expect(latest().said.text).toBe(
      'Couldn’t dismiss beta pull request 3, “Change 3”: the API didn’t take it.',
    );
  });

  it('drops the question when something else is asked, which goes to the router', async () => {
    const { type, entry, latest, route, http } = setUp();

    await type('dismiss 3');
    const askedId = latest().id;
    await type('how are you');
    await vi.waitFor(() => expect(route).toHaveBeenCalled());

    expect(entry(askedId)?.said.text).toBe(
      'Dismiss beta pull request 3, “Change 3”? It comes back if it changes. Left it.',
    );
    expect(entry(askedId)?.actions).toEqual([]);
    http.expectNone('/api/triage');
  });

  it('lets the question lapse, so a later yes is only words', async () => {
    const { type, entry, latest, route, http } = setUp();

    await type('snooze 12');
    const askedId = latest().id;
    vi.advanceTimersByTime(QUESTION_MS);
    expect(entry(askedId)?.said.text).toBe(
      `Snooze alpha pull request 12, “Change 12”, for a week? ${TIMED_OUT_NOTE}`,
    );

    await type('yes');
    await vi.waitFor(() => expect(route).toHaveBeenCalled());
    http.expectNone('/api/triage');
  });

  it('asks which project when the number is open in more than one', async () => {
    const { type, latest, http } = setUp([project('alpha', [3]), project('beta', [3])]);

    await type('dismiss 3');

    expect(latest().said.text).toBe(
      'Pull request 3 is open in alpha and beta. Say which, as in “dismiss 3 in alpha”.',
    );
    expect(latest().actions).toEqual([]);
    await type('yes');
    http.expectNone('/api/triage');
  });

  it('says when the pull request is not open', async () => {
    const { type, latest } = setUp();

    await type('snooze 99 till Friday');

    expect(latest().said.text).toBe('Pull request 99 isn’t open in any project.');
  });

  it('snoozes for no longer than the API records, asking nothing', async () => {
    const { type, latest } = setUp();

    await type('snooze 12 for 13 weeks');

    expect(latest().said.text).toBe('I can snooze for 90 days at most.');
    expect(latest().actions).toEqual([]);
  });

  it('says so when no queue can be read', async () => {
    const { type, latest, http } = setUp();

    await type('what’s blocking?');
    for (const repo of ['me/alpha', 'me/beta']) {
      http
        .expectOne(`/api/queue?repo=${repo}`)
        .flush('down', { status: 502, statusText: 'Bad Gateway' });
    }

    expect(latest().said.text).toBe(OUT_OF_REACH);
  });

  it('reads the queues that answer and counts the ones that did not', async () => {
    const { type, latest, http } = setUp();

    await type('what’s blocking?');
    http
      .expectOne('/api/queue?repo=me/alpha')
      .flush('down', { status: 502, statusText: 'Bad Gateway' });
    http
      .expectOne('/api/queue?repo=me/beta')
      .flush({ generatedAt: 'x', repo: 'me/beta', items: [queueItem(3, 'conflicted')] });

    expect(latest().said.text).toMatch(/^Only 1 pull request to work.* 1 queue out of reach\.$/);
  });

  it('leaves the words to the router where the site has no Jev', async () => {
    const { type, info, route } = setUp();
    info.noteAbsent();

    await type('next star');

    await vi.waitFor(() => expect(route).toHaveBeenCalled());
  });
});
