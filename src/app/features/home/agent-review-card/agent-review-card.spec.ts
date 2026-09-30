import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AgentFocus } from '../../../core/agent-usage/agent-focus';
import { AgentReminders } from '../../../core/agent-usage/agent-reminders';
import { AgentReviewCard } from './agent-review-card';

function render(due: string | null) {
  const reminders = { due: signal(due), done: vi.fn(), snooze: vi.fn() };
  TestBed.configureTestingModule({ providers: [{ provide: AgentReminders, useValue: reminders }] });
  const fixture = TestBed.createComponent(AgentReviewCard);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = (words: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((each) =>
      each.textContent?.includes(words),
    );
  return { element, button, reminders };
}

describe('AgentReviewCard', () => {
  it('shows nothing while no review is due', () => {
    expect(render(null).element.querySelector('aside')).toBeNull();
  });

  it('walks through three charts in order, each opening its own', () => {
    const { element, button } = render('2026-09-28');

    expect(Array.from(element.querySelectorAll('li b')).map((title) => title.textContent)).toEqual([
      'Tokens by day',
      'Who spends the tokens',
      'How full each context gets',
    ]);
    button('Who spends the tokens')?.click();
    expect(TestBed.inject(AgentFocus).request()?.chart).toBe('rank');
  });

  it('is done for the week, or put off until Monday', () => {
    const { button, reminders } = render('2026-09-28');

    button('Done for this week')?.click();
    button('Remind me Monday')?.click();
    expect(reminders.done).toHaveBeenCalledTimes(1);
    expect(reminders.snooze).toHaveBeenCalledTimes(1);
  });
});
