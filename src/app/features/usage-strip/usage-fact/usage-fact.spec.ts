import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Clock } from '../../../core/time/clock';
import { UsageFeed } from '../../../core/usage/usage-feed';
import { UsageState } from '../../../core/usage/usage-reader';
import { STATUS_STRIP_VIEW } from '../../../shared/status-strip/status-fact';
import { UsageFact } from './usage-fact';

const NOW = new Date(2026, 9, 7, 9, 0);
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

const ready: UsageState = {
  status: 'ready',
  document: {
    generatedAt: iso(NOW.getTime()),
    limits: {
      at: iso(NOW.getTime()),
      five: { pct: 84, resetsAt: iso(NOW.getTime() + 2 * HOUR), points: [] },
      week: { pct: 61, resetsAt: iso(NOW.getTime() + 50 * HOUR), points: [] },
      weeks: [],
    },
    tools: [],
    projects: [],
  },
};

function render(state: UsageState) {
  const usage = signal(state);
  const isCollapsed = signal(false);
  TestBed.configureTestingModule({
    providers: [
      { provide: UsageFeed, useValue: { state: usage } },
      { provide: Clock, useValue: { now: signal(NOW) } },
      { provide: STATUS_STRIP_VIEW, useValue: { isCollapsed } },
    ],
  });
  const fixture = TestBed.createComponent(UsageFact);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const textsOf = (selector: string) =>
    [...element.querySelectorAll(selector)].map((node) => node.textContent?.trim());
  return { fixture, usage, isCollapsed, element, textsOf };
}

describe('UsageFact', () => {
  it('shows both limits and the reset of the one nearer its limit, hot from 80%', () => {
    const { fixture, element, textsOf } = render(ready);
    const limits = element.querySelectorAll('.limit');

    expect(textsOf('.limit__label')).toEqual(['5h', 'wk']);
    expect(textsOf('.limit__value')).toEqual(['84%', '61%']);
    expect(textsOf('.reset')).toEqual(['5h resets 11:00']);
    expect(limits[0].classList).toContain('hot');
    expect(limits[1].classList).not.toContain('hot');
    expect(fixture.componentInstance.isShown()).toBe(true);
  });

  it('folded, shows only the higher percent', () => {
    const { fixture, isCollapsed, element } = render(ready);

    isCollapsed.set(true);
    fixture.detectChanges();

    expect(element.querySelector('.limit')).toBeNull();
    expect(element.querySelector('.peak')?.textContent?.trim()).toMatch(/higher limit: 84%$/);
    expect(element.querySelector('.peak')?.classList).toContain('hot');
  });

  it('has nothing to show while usage is out of reach or missing', () => {
    const { fixture, usage, element } = render({ status: 'unreachable' });

    expect(fixture.componentInstance.isShown()).toBe(false);
    expect(element.textContent?.trim()).toBe('');

    usage.set({ status: 'missing' });
    fixture.detectChanges();
    expect(fixture.componentInstance.isShown()).toBe(false);
  });
});
