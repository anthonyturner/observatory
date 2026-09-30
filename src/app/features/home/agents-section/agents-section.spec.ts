import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AgentFocus } from '../../../core/agent-usage/agent-focus';
import { BROWSER_NOTICES, BrowserNotices } from '../../../core/agent-usage/browser-notices';
import { TrailActivity } from '../../../core/sky/trail-activity';
import { of } from 'rxjs';
import { AGENT_USAGE_READ, AgentUsageState } from '../../../core/agent-usage/agent-usage-feed';
import { AGENT_NOW, agentRun } from '../../../core/agent-usage/testing/agent-run-fixture';
import { AgentsSection } from './agents-section';

const READY: AgentUsageState = {
  status: 'ready',
  document: {
    generatedAt: new Date(AGENT_NOW).toISOString(),
    days: 30,
    from: '2026-09-01',
    runs: [
      agentRun('d1', { agent: 'dev', description: 'Build the toolbar' }),
      agentRun('p1', { agent: 'pm', description: 'File the issue' }),
      agentRun('r1', { agent: 'dev', project: 'RivalsPulse', description: 'Fix the roster' }),
    ],
  },
};

/** A browser without notifications: whatever is asked, they stay off. */
const REFUSING: BrowserNotices = {
  permission: () => 'unsupported',
  request: async () => false,
  show: () => undefined,
};

function render(state: AgentUsageState) {
  TestBed.configureTestingModule({
    providers: [
      { provide: AGENT_USAGE_READ, useValue: () => of(state) },
      {
        provide: TrailActivity,
        useValue: { measured: signal(null), pace: signal(1), ratio: signal(null) },
      },
      { provide: BROWSER_NOTICES, useValue: REFUSING },
    ],
  });
  const fixture = TestBed.createComponent(AgentsSection);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

const listed = (element: HTMLElement): string[] =>
  Array.from(element.querySelectorAll('app-agent-runs-list tbody td.what')).map(
    (cell) => cell.textContent?.trim() ?? '',
  );

describe('AgentsSection', () => {
  it('says where things stand instead of drawing empty charts', () => {
    expect(
      render({ status: 'unreachable' }).element.querySelector('.empty')?.textContent,
    ).toContain('is the API running');
  });

  it('says how runs will appear when there are none yet', () => {
    const empty: AgentUsageState = { status: 'ready', document: { ...READY.document, runs: [] } };

    expect(render(empty).element.querySelector('.empty')?.textContent).toContain('once an agent');
  });

  it('draws the five charts with what each is for, and the latest runs', () => {
    const { element } = render(READY);

    for (const chart of [
      'app-agent-orrery-view',
      'app-agent-rank-view',
      'app-agent-daily-view',
      'app-agent-context-view',
      'app-agent-grid-view',
    ]) {
      expect(element.querySelector(`${chart} svg`)).not.toBeNull();
    }
    expect(element.querySelectorAll('.use')).toHaveLength(5);
    expect(element.querySelector('.sum')?.textContent).toContain('3 runs');
    expect(listed(element)).toHaveLength(3);
  });

  it('narrows the runs to an agent picked from its bar, and clears it from its chip', () => {
    const { fixture, element } = render(READY);
    const pm = Array.from(
      element.querySelectorAll<SVGRectElement>('app-agent-rank-view .hit'),
    ).find((hit) => hit.getAttribute('aria-label')?.startsWith('pm'));

    pm?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(listed(element)).toEqual(['File the issue']);
    expect(element.querySelector('.wide:last-of-type h3')?.textContent).toBe('pm runs');

    element.querySelector<HTMLButtonElement>('.chip')?.click();
    fixture.detectChanges();
    expect(listed(element)).toHaveLength(3);
  });

  it('opens the chart a reminder asks for, narrowed, and outlines it', () => {
    // jsdom lays nothing out, so it has no scrolling to do.
    Element.prototype.scrollIntoView = vi.fn();
    const { fixture, element } = render(READY);
    TestBed.inject(AgentFocus).show({ chart: 'rank', agent: 'pm' });
    fixture.detectChanges();

    expect(listed(element)).toEqual(['File the issue']);
    expect(element.querySelector('#agents-rank')?.classList).toContain('flash');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it('does not replay a chart request when the section is built again, after Back', () => {
    const { fixture } = render(READY);
    TestBed.inject(AgentFocus).show({ chart: 'rank', agent: 'pm' });
    fixture.detectChanges();
    fixture.destroy();

    const rebuilt = TestBed.createComponent(AgentsSection);
    rebuilt.detectChanges();
    expect(listed(rebuilt.nativeElement as HTMLElement)).toHaveLength(3);
  });

  it('unticks Notify me when the browser will not notify', async () => {
    localStorage.clear();
    const { fixture, element } = render(READY);
    const box = element.querySelector<HTMLInputElement>('#agents-review-notify');
    box!.click();
    await fixture.whenStable();

    expect(box?.checked).toBe(false);
  });

  it('chooses the review day, or turns reminders off', () => {
    localStorage.clear();
    const { fixture, element } = render(READY);
    const day = element.querySelector<HTMLSelectElement>('#agents-review-day');

    expect(day?.value).toBe('5');
    day!.value = '';
    day!.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(element.querySelector<HTMLInputElement>('#agents-review-notify')?.disabled).toBe(true);
  });

  it('narrows the charts to any project picked from the Project list', () => {
    const { fixture, element } = render(READY);
    const select = element.querySelector<HTMLSelectElement>('#agents-project');

    expect(Array.from(select?.options ?? []).map((option) => option.value)).toEqual([
      '',
      'observatory',
      'RivalsPulse',
    ]);
    select!.value = 'RivalsPulse';
    select!.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(listed(element)).toEqual(['Fix the roster']);
  });

  it('narrows every chart to a project picked from the grid', () => {
    const { fixture, element } = render(READY);
    const cell = Array.from(
      element.querySelectorAll<SVGRectElement>('app-agent-grid-view .cell'),
    ).find(
      (each) =>
        each.getAttribute('aria-label')?.includes('RivalsPulse') &&
        each.getAttribute('aria-label')?.startsWith('dev'),
    );

    cell?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(listed(element)).toEqual(['Fix the roster']);
    expect(element.querySelector('.sum')?.textContent).toContain('1 runs');
  });
});
