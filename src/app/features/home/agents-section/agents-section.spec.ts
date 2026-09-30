import { TestBed } from '@angular/core/testing';
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

function render(state: AgentUsageState) {
  TestBed.configureTestingModule({
    providers: [{ provide: AGENT_USAGE_READ, useValue: () => of(state) }],
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
