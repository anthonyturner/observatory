import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { HistoryFeed } from '../../../core/queue/history-feed';
import { UsageDocument } from '../../../core/usage/usage-document';
import { USAGE_READ, UsageState } from '../../../core/usage/usage-reader';
import { UsageWatch } from '../../../core/usage/usage-watch';
import { ELEMENT_WIDTH } from '../../../shared/element-width/element-width';
import { StarmapUsage } from './starmap-usage';

const DOCUMENT: UsageDocument = {
  generatedAt: '2026-09-26T08:46:24Z',
  limits: {
    at: '2026-09-26T08:34:40Z',
    week: {
      pct: 7,
      resetsAt: '2026-10-02T19:00:00Z',
      points: [[Date.parse('2026-09-26T08:00:00Z'), 7]],
    },
    weeks: [],
  },
  tokens: {
    days: 30,
    from: '2026-08-28',
    rows: [],
    totals: { tokens: 1, cacheRead: 1, messages: 1, sessions: 1, toolCalls: 1, subagents: 0 },
    models: [],
  },
  tools: [{ name: 'Bash', count: 3 }],
  projects: [{ name: 'app', repo: 'me/app', tokens: 5, cacheRead: 0, messages: 1, sessions: 1 }],
};

describe('StarmapUsage', () => {
  /** The watch reads on a timer's first tick. */
  const tick = () => new Promise((resolve) => setTimeout(resolve));

  async function setUp() {
    const reads: Subject<UsageState>[] = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        UsageWatch,
        HistoryFeed,
        { provide: ELEMENT_WIDTH, useValue: () => of(600) },
        {
          provide: USAGE_READ,
          useValue: () => {
            const read = new Subject<UsageState>();
            reads.push(read);
            return read;
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(StarmapUsage);
    fixture.componentRef.setInput('repo', 'me/app');
    fixture.detectChanges();
    const watch = TestBed.inject(UsageWatch);
    await tick();
    return { fixture, reads, watch, host: fixture.nativeElement as HTMLElement };
  }

  it('says it is reading until the report arrives, then draws each section', async () => {
    const { fixture, reads, host } = await setUp();
    expect(host.textContent).toContain('Reading usage…');

    reads[0].next({ status: 'ready', document: DOCUMENT });
    await fixture.whenStable();

    const headings = [...host.querySelectorAll('h3')].map((h) => h.firstChild?.textContent?.trim());
    expect(headings).toEqual(['Plan limits', 'Tokens', 'By project', 'Tools']);
    expect(host.textContent).toContain('tokens, last 30 days · this one lit');
  });

  it('says there is no usage when the API cannot give it', async () => {
    const { fixture, reads, host } = await setUp();

    reads[0].next({ status: 'unreachable' });
    await fixture.whenStable();

    expect(host.textContent).toContain('No usage read yet.');
  });

  it('shows a mark’s tooltip under the pointer', async () => {
    const { fixture, reads, host } = await setUp();
    reads[0].next({ status: 'ready', document: DOCUMENT });
    await fixture.whenStable();

    const mark = host.querySelector('[data-tip]');
    mark?.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 10, clientY: 90 }),
    );
    await fixture.whenStable();

    const tip = host.querySelector<HTMLElement>('app-usage-tip');
    expect(tip?.hidden).toBe(false);
    expect(tip?.textContent).toContain('of the week used');

    host.dispatchEvent(new PointerEvent('pointerleave'));
    await fixture.whenStable();
    expect(tip?.hidden).toBe(true);
  });

  it('stops reading when the screen closes', async () => {
    const { fixture, watch } = await setUp();
    const stop = vi.spyOn(watch, 'stop');

    fixture.destroy();

    expect(stop).toHaveBeenCalled();
  });
});
