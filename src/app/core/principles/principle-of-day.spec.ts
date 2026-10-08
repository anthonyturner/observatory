import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { Clock } from '../time/clock';
import { PRINCIPLES_READ, PrincipleOfDay } from './principle-of-day';
import { Principle, PrinciplesState } from './principle.types';

const principle = (id: string): Principle => ({
  id,
  title: `Title ${id}`,
  idea: `Idea ${id}.`,
  question: `Question ${id}?`,
});
const DECK = [principle('a'), principle('b'), principle('c')];
const ready = (today: number): PrinciplesState => ({
  status: 'ready',
  report: { principles: DECK, today },
});

function setUp() {
  const now = signal(new Date(2026, 9, 8, 23, 59));
  const answers = new Subject<PrinciplesState>();
  const days: string[] = [];
  TestBed.configureTestingModule({
    providers: [
      { provide: Clock, useValue: { now } },
      {
        provide: PRINCIPLES_READ,
        useValue: (day: string) => {
          days.push(day);
          return answers;
        },
      },
    ],
  });
  const service = TestBed.inject(PrincipleOfDay);
  TestBed.tick();
  return { service, now, answers, days };
}

describe('PrincipleOfDay', () => {
  it('asks for the page’s own calendar day and shows that day’s principle', () => {
    const { service, answers, days } = setUp();
    expect(service.shown()).toBeNull();

    answers.next(ready(1));

    expect(days).toEqual(['2026-10-08']);
    expect(service.shown()).toEqual({ principle: DECK[1], place: 2, count: 3, isToday: true });
  });

  it('steps through the others, round past either end, and back to today’s', () => {
    const { service, answers } = setUp();
    answers.next(ready(2));

    service.next();
    expect(service.shown()).toEqual(expect.objectContaining({ place: 1, isToday: false }));

    service.previous();
    service.previous();
    expect(service.shown()?.principle).toBe(DECK[1]);

    service.backToToday();
    expect(service.shown()).toEqual(expect.objectContaining({ place: 3, isToday: true }));
  });

  it('reads again when the day turns, and starts again from the new day’s', () => {
    const { service, now, answers, days } = setUp();
    answers.next(ready(0));
    service.next();

    now.set(new Date(2026, 9, 9, 0, 0));
    TestBed.tick();
    answers.next(ready(1));

    expect(days).toEqual(['2026-10-08', '2026-10-09']);
    expect(service.shown()).toEqual(expect.objectContaining({ place: 2, isToday: true }));
  });

  it('shows nothing when the site could not be reached', () => {
    const { service, answers } = setUp();

    answers.next({ status: 'unreachable' });

    expect(service.shown()).toBeNull();
  });
});
