import { TestBed } from '@angular/core/testing';
import { SprintPhase } from '../review-sprint';
import { SprintOption, SprintRow } from '../sprint-plan';
import { SprintPanel, countdownOf } from './sprint-panel';

const pick = (pr: number, minutes = 8) => ({ pr, title: `Change ${pr}`, lines: 50, minutes });
const options: SprintOption[] = [
  { minutes: 15, picks: [] },
  { minutes: 25, picks: [pick(1), pick(2)] },
  { minutes: 45, picks: [pick(1), pick(2), pick(3)] },
];
const rows: SprintRow[] = [
  { ...pick(1), mark: 'merged' },
  { ...pick(2), mark: 'reviewed' },
  { ...pick(3, 4.2), mark: 'open' },
];

function render(phase: SprintPhase, inputs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(SprintPanel);
  fixture.componentRef.setInput('phase', phase);
  fixture.componentRef.setInput('options', options);
  fixture.componentRef.setInput('rows', rows);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = (words: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.replace(/\s+/g, ' ').trim().startsWith(words),
    );
  return { fixture, element, button };
}

describe('countdownOf', () => {
  it('reads minutes and seconds, a part second as a whole one', () => {
    expect(countdownOf(25 * 60_000)).toBe('25:00');
    expect(countdownOf(65_001)).toBe('1:06');
    expect(countdownOf(0)).toBe('0:00');
    expect(countdownOf(-5)).toBe('0:00');
  });
});

describe('SprintPanel', () => {
  it('offers each length with how many pull requests fit, none greyed out', () => {
    const { fixture, button } = render('setup');
    const started: SprintOption[] = [];
    fixture.componentInstance.start.subscribe((o) => started.push(o));

    expect(button('15 min')?.textContent).toContain('none fit');
    expect(button('15 min')?.disabled).toBe(true);
    expect(button('25 min')?.textContent).toContain('2 PRs');
    expect(button('25 min')?.title).toBe('#1 Change 1\n#2 Change 2');

    button('45 min')?.click();
    expect(started.map((o) => o.minutes)).toEqual([45]);
  });

  it('runs a timer and lists the sprint, each row opening its pull request', () => {
    const { fixture, element, button } = render('running', {
      remainingMs: 10 * 60_000,
      totalMs: 25 * 60_000,
    });
    const went: number[] = [];
    let ended = 0;
    fixture.componentInstance.go.subscribe((pr) => went.push(pr));
    fixture.componentInstance.end.subscribe(() => ended++);

    expect(element.querySelector('[role="timer"]')?.textContent).toBe('10:00');
    expect((element.querySelector('.bar') as HTMLElement).style.width).toBe('60%');
    expect(Array.from(element.querySelectorAll('.mark')).map((m) => m.textContent)).toEqual([
      'merged',
      'reviewed',
      '~5 min',
    ]);
    expect(button('×')).toBeUndefined();

    button('#3')?.click();
    button('End sprint')?.click();
    expect(went).toEqual([3]);
    expect(ended).toBe(1);
  });

  it('sums up what the sprint cleared as merged, reviewed and skipped', () => {
    const { fixture, element, button } = render('summary');
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);

    expect(element.querySelector('h2')?.textContent).toBe('Sprint over');
    expect(element.querySelector('[role="status"]')?.textContent).toBe(
      '1 merged · 1 reviewed · 1 skipped',
    );
    expect(Array.from(element.querySelectorAll('h3')).map((h) => h.textContent)).toEqual([
      'Merged',
      'Reviewed',
      'Skipped',
    ]);

    button('Done')?.click();
    expect(closed).toBe(1);
  });

  it('marks itself still when motion is off, so the bar steps', () => {
    const { fixture } = render('running', { still: true });

    expect((fixture.nativeElement as HTMLElement).classList).toContain('still');
  });
});
