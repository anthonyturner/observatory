import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Clock } from '../../../core/time/clock';
import { ReviewSprint } from './review-sprint';
import { SprintOption } from './sprint-plan';

const START = new Date('2026-10-06T10:00:00Z');
const option: SprintOption = {
  minutes: 15,
  picks: [
    { pr: 1, title: 'One', lines: 50, minutes: 8 },
    { pr: 2, title: 'Two', lines: 25, minutes: 5 },
  ],
};

function setUp() {
  const now = signal(START);
  TestBed.configureTestingModule({
    providers: [ReviewSprint, { provide: Clock, useValue: { now } }],
  });
  const sprint = TestBed.inject(ReviewSprint);
  const at = (minutes: number) => now.set(new Date(START.getTime() + minutes * 60_000));
  return { sprint, at };
}

describe('ReviewSprint', () => {
  it('opens the lengths to choose from, then runs the one chosen', () => {
    const { sprint } = setUp();
    expect(sprint.phase()).toBeNull();

    sprint.toggleSetup();
    expect(sprint.phase()).toBe('setup');

    sprint.start(option);
    expect(sprint.phase()).toBe('running');
    expect(sprint.prs()).toEqual([1, 2]);
    expect(sprint.remainingMs()).toBe(15 * 60_000);
  });

  it('counts down, and ends by itself when the time is up', () => {
    const { sprint, at } = setUp();
    sprint.start(option);

    at(10);
    expect(sprint.remainingMs()).toBe(5 * 60_000);

    at(15);
    expect(sprint.isRunning()).toBe(false);
    expect(sprint.phase()).toBe('summary');
    expect(sprint.remainingMs()).toBe(0);
  });

  it('can be ended early, on to its summary', () => {
    const { sprint, at } = setUp();
    sprint.start(option);
    at(4);

    sprint.end();

    expect(sprint.phase()).toBe('summary');
    expect(sprint.sprint()?.endedAt).toBe(START.getTime() + 4 * 60_000);
  });

  it('counts only its own pull requests as reviewed, and only while it runs', () => {
    const { sprint } = setUp();
    sprint.start(option);

    sprint.markReviewed(1);
    sprint.markReviewed(9);
    sprint.end();
    sprint.markReviewed(2);

    expect([...sprint.reviewed()]).toEqual([1]);
  });

  it('puts the summary away on close, ready for another', () => {
    const { sprint } = setUp();
    sprint.start(option);
    sprint.markReviewed(1);
    sprint.end();

    sprint.close();

    expect(sprint.phase()).toBeNull();
    expect(sprint.prs()).toEqual([]);
    expect(sprint.reviewed().size).toBe(0);
  });

  it('keeps a sprint on show when the lengths are toggled', () => {
    const { sprint } = setUp();
    sprint.start(option);

    sprint.toggleSetup();

    expect(sprint.phase()).toBe('running');
  });
});
