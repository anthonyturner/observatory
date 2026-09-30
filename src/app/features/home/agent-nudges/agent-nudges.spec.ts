import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AgentFocus } from '../../../core/agent-usage/agent-focus';
import { Nudge } from '../../../core/agent-usage/agent-nudges';
import { AgentReminders } from '../../../core/agent-usage/agent-reminders';
import { AgentNudges } from './agent-nudges';

const NUDGES: Nudge[] = [
  {
    id: 'near-limit:dev',
    kind: 'near-limit',
    text: 'dev ran near or past the 200k context window 3 times this week',
    target: { kind: 'chart', chart: 'context', agent: 'dev' },
  },
  {
    id: 'rework:me/rivals#618',
    kind: 'rework',
    text: '#618 in rivals ran its dev stage again',
    target: { kind: 'issue', repo: 'me/rivals', issue: 618 },
  },
];

function render(nudges: Nudge[]) {
  const dismiss = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AgentReminders, useValue: { nudges: signal(nudges), dismiss } },
    ],
  });
  const fixture = TestBed.createComponent(AgentNudges);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const buttons = (selector: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>(selector));
  return { element, buttons, dismiss };
}

describe('AgentNudges', () => {
  it('says what happened on each nudge', () => {
    const { buttons } = render(NUDGES);

    expect(buttons('.open').map((button) => button.textContent?.trim())).toEqual(
      NUDGES.map((n) => n.text),
    );
  });

  it('opens a chart nudge’s chart, narrowed to what it names', () => {
    const { buttons } = render(NUDGES);
    buttons('.open')[0].click();

    expect(TestBed.inject(AgentFocus).request()).toEqual(
      expect.objectContaining({ chart: 'context', agent: 'dev' }),
    );
  });

  it('opens a rework nudge’s issue on its star map, where its pipeline shows', () => {
    const { buttons } = render(NUDGES);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    buttons('.open')[1].click();

    expect(navigate).toHaveBeenCalledWith(['/p', 'me', 'rivals'], { queryParams: { issue: 618 } });
  });

  it('rests a nudge’s kind when dismissed', () => {
    const { buttons, dismiss } = render(NUDGES);
    buttons('.close')[0].click();

    expect(dismiss).toHaveBeenCalledWith('near-limit');
  });

  it('draws nothing when there is nothing to nudge about', () => {
    expect(render([]).element.querySelector('ul')).toBeNull();
  });
});
