import { TestBed } from '@angular/core/testing';
import { OpenItem } from './open-items';
import { OpenQuestion, QUESTION_MS, TIMED_OUT_NOTE } from './open-question';

const ITEM: OpenItem = {
  kind: 'pull',
  repo: 'me/alpha',
  label: 'alpha',
  number: 12,
  title: 'Fix the bar',
  href: '/p/me/alpha?pr=12',
};

describe('OpenQuestion', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits with the items it was asked about', () => {
    const question = TestBed.inject(OpenQuestion);

    question.ask('Would you like to open it?', [ITEM]);

    expect(question.isWaiting()).toBe(true);
    expect(question.question()).toEqual(
      expect.objectContaining({ words: 'Would you like to open it?', items: [ITEM] }),
    );
  });

  it('times out after two minutes, keeping the card to say so', () => {
    const question = TestBed.inject(OpenQuestion);
    question.ask('Would you like to open it?', [ITEM]);

    vi.advanceTimersByTime(QUESTION_MS - 1);
    expect(question.isWaiting()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(question.isWaiting()).toBe(false);
    expect(question.question()?.hasTimedOut).toBe(true);
    expect(TIMED_OUT_NOTE).toBe('No answer in 2 minutes, so the question closed.');
  });

  it('closes, and a closed question never times out later', () => {
    const question = TestBed.inject(OpenQuestion);
    question.ask('Would you like to open it?', [ITEM]);

    question.close();
    vi.advanceTimersByTime(QUESTION_MS);

    expect(question.question()).toBeNull();
  });

  it('gives a new question its own two minutes', () => {
    const question = TestBed.inject(OpenQuestion);
    question.ask('first', [ITEM]);
    vi.advanceTimersByTime(QUESTION_MS / 2);

    question.ask('second', [ITEM]);
    vi.advanceTimersByTime(QUESTION_MS / 2);

    expect(question.isWaiting()).toBe(true);
    expect(question.question()?.words).toBe('second');
  });

  it('can ask only while the Ask panel is on screen, and closes when it goes', () => {
    const question = TestBed.inject(OpenQuestion);
    expect(question.canAsk()).toBe(false);

    question.panelArrived();
    question.ask('Would you like to open it?', [ITEM]);
    expect(question.canAsk()).toBe(true);

    question.panelLeft();
    expect(question.canAsk()).toBe(false);
    expect(question.question()).toBeNull();
  });
});
