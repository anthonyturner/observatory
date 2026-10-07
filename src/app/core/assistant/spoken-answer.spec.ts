import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { REPLY_VOICE, ReplyVoice } from '../voice/reply-voice';
import { ASK_CHANNEL } from './ask-channel';
import { AskDraft } from './ask-draft';
import { ASK_FEED_CHANNEL, AskFeed } from './ask-feed';
import { ASSISTANT_API, AssistantApi } from './assistant-api';
import { RouteReply, RouteRequest } from './assistant.types';
import { OpenItem } from './open-items';
import { OpenQuestion, QUESTION_MS } from './open-question';
import { GRACE_MS } from './page-jump';
import { QUESTION_ANSWER_CHIP } from './reply-chip';
import { ReplyLog } from './reply-log';
import { LEFT_IT, ONE_AT_A_TIME, WHICH_ONE } from './spoken-answer';

const PULL: OpenItem = {
  kind: 'pull',
  repo: 'me/alpha',
  label: 'alpha',
  number: 12,
  title: 'Dark mode toggle',
  href: '/p/me/alpha?pr=12',
};
const ISSUE: OpenItem = {
  kind: 'issue',
  repo: 'me/beta',
  label: 'beta',
  number: 21,
  title: 'Crash on login',
  href: '/p/me/beta?issue=21',
};

const HELLO: RouteReply = { tier: 2, text: 'Hi', ask: [], commands: [], sources: [] };

function setUp(items: readonly OpenItem[] = [PULL, ISSUE]) {
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
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      ASK_FEED_CHANNEL,
      { provide: ASSISTANT_API, useValue: api },
      { provide: REPLY_VOICE, useValue: voice },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const question = TestBed.inject(OpenQuestion);
  question.ask('Would you like to open any of them?', items);
  const log = TestBed.inject(ReplyLog);
  const say = (words: string): void => TestBed.inject(ASK_CHANNEL).submit(words, { spoken: true });
  const latest = () => log.entries()[0];
  return { say, latest, log, question, route, voice, navigate, draft: TestBed.inject(AskDraft) };
}

describe('a spoken answer to Jev’s question', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens the item in-app after the grace second, in a reply of its own', async () => {
    const { say, latest, question, route, voice, navigate } = setUp();

    say('Number 12.');

    expect(latest()).toEqual(
      expect.objectContaining({ asked: 'Number 12.', how: 'spoken', chip: QUESTION_ANSWER_CHIP }),
    );
    expect(latest().said.text).toBe('Opening pull request 12 in alpha…');
    expect(latest().actions).toEqual([{ kind: 'stay' }]);
    expect(voice.speak).toHaveBeenCalledWith('Opening pull request 12 in alpha…', 1);
    expect(question.question()).toBeNull();
    expect(route).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(GRACE_MS);

    expect(navigate).toHaveBeenCalledExactlyOnceWith('/p/me/alpha?pr=12');
  });

  it('opens an issue by its place on the card, and Stay here keeps the page', async () => {
    const { say, latest, navigate } = setUp();

    say('The last one.');
    expect(latest().said.text).toBe('Opening issue 21 in beta…');
    TestBed.inject(AskFeed).press(latest().id, { kind: 'stay' });
    await vi.advanceTimersByTimeAsync(GRACE_MS * 2);

    expect(navigate).not.toHaveBeenCalled();
    expect(latest().said).toEqual(
      expect.objectContaining({ text: 'Stayed here. ', openHref: '/p/me/beta?issue=21' }),
    );
  });

  it('opens the only item on a yes', () => {
    const { say, latest } = setUp([PULL]);

    say('Yes.');

    expect(latest().said.text).toBe('Opening pull request 12 in alpha…');
  });

  it('closes the card on no, going nowhere', async () => {
    const { say, latest, question, route, navigate, voice } = setUp();

    say('No thanks.');
    await vi.advanceTimersByTimeAsync(GRACE_MS);

    expect(question.question()).toBeNull();
    expect(latest().said).toEqual(expect.objectContaining({ text: LEFT_IT, isNote: true }));
    expect(route).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(voice.speak).not.toHaveBeenCalled();
  });

  it('asks which one on a yes with several items, keeping the card', () => {
    const { say, latest, question, voice, draft } = setUp();

    say('Yes.');

    expect(latest().said.text).toBe(WHICH_ONE);
    expect(voice.speak).toHaveBeenCalledWith(WHICH_ONE, 1);
    expect(question.isWaiting()).toBe(true);
    expect(draft.heard()).toBeNull();
  });

  it('opens one at a time when asked for all of them, going nowhere', async () => {
    const { say, latest, question, voice, navigate } = setUp();

    say('All of them.');
    await vi.advanceTimersByTimeAsync(GRACE_MS);

    expect(latest().said.text).toBe(ONE_AT_A_TIME);
    expect(voice.speak).toHaveBeenCalledWith(ONE_AT_A_TIME, 1);
    expect(question.isWaiting()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('says what it heard when unclear, aloud only the first time, and puts it in the box', () => {
    const { say, log, question, voice, draft, route } = setUp();

    say('Number 13.');
    say('The fifth one.');

    const [second, first] = log.entries();
    expect(first.said.text).toBe(
      'Heard “Number 13”, but I can’t tell which one that is. Say its number, or press Open.',
    );
    expect(second.said.text).toContain('Heard “The fifth one”');
    expect(voice.speak).toHaveBeenCalledExactlyOnceWith(first.said.text, 1);
    expect(draft.heard()).toEqual({ words: 'The fifth one.', n: 2 });
    expect(question.isWaiting()).toBe(true);
    expect(route).not.toHaveBeenCalled();
  });

  it('speaks the first unclear answer to a new question again', () => {
    const { say, question, voice } = setUp();
    say('Number 13.');

    question.ask('Would you like to open it?', [PULL]);
    say('Number 13.');

    expect(voice.speak).toHaveBeenCalledTimes(2);
  });

  it('takes typed words as the same answer, in a typed reply', () => {
    const { latest, route } = setUp();

    TestBed.inject(ASK_CHANNEL).submit('12');

    expect(latest()).toEqual(expect.objectContaining({ asked: '12', how: 'typed' }));
    expect(latest().said.text).toBe('Opening pull request 12 in alpha…');
    expect(route).not.toHaveBeenCalled();
  });

  it('leaves typed words that named nothing out of the box, where they were typed', () => {
    const { latest, draft } = setUp();

    TestBed.inject(ASK_CHANNEL).submit('number 13');

    expect(latest().said.text).toContain('Heard “number 13”');
    expect(draft.heard()).toBeNull();
  });

  it('opens one named by its project: “the alpha one”', () => {
    const { say, latest } = setUp();

    say('the alpha one');

    expect(latest().said.text).toBe('Opening pull request 12 in alpha…');
  });

  describe('is not taken from words that answer nothing', () => {
    it('treats typed words that answer nothing as a request', () => {
      const { question, route } = setUp();

      TestBed.inject(ASK_CHANNEL).submit('what is the weather');

      expect(route).toHaveBeenCalledWith({ text: 'what is the weather', history: [] });
      expect(question.question()).toBeNull();
    });

    it('sends an ordinary request on as before, which closes the question', async () => {
      const { say, question, route } = setUp();

      say('What is the weather?');
      await vi.advanceTimersByTimeAsync(0);

      expect(route).toHaveBeenCalledWith({ text: 'What is the weather?', history: [] });
      expect(question.question()).toBeNull();
    });

    it('holds a request in the box while the box has words, keeping the card', () => {
      const { say, question, route, draft } = setUp();
      draft.noteBox('half typed');

      say('refresh everything');

      expect(route).not.toHaveBeenCalled();
      expect(draft.heard()?.words).toBe('refresh everything');
      expect(question.isWaiting()).toBe(true);
    });

    it('sends an answer as a request once the question has timed out', () => {
      const { say, route, navigate } = setUp();
      vi.advanceTimersByTime(QUESTION_MS);

      say('Number 12.');

      expect(route).toHaveBeenCalledWith({ text: 'Number 12.', history: [] });
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
