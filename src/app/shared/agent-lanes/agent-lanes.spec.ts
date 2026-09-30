import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AGENT_USAGE_READ, AgentUsageState } from '../../core/agent-usage/agent-usage-feed';
import { runEndingAt } from '../../core/agent-usage/testing/agent-run-fixture';
import { AgentLanes } from './agent-lanes';

const READY: AgentUsageState = {
  status: 'ready',
  document: {
    generatedAt: '',
    days: 30,
    from: '',
    runs: [
      runEndingAt('pm', 3, 5, { agent: 'pm', issue: 12 }),
      runEndingAt('dev', 1, 30, { agent: 'dev', branch: 'feat/12-thing', issue: 12 }),
    ],
  },
};

function render(inputs: { issue?: number | null; branch?: string | null }) {
  TestBed.configureTestingModule({
    providers: [{ provide: AGENT_USAGE_READ, useValue: () => of(READY) }],
  });
  const fixture = TestBed.createComponent(AgentLanes);
  fixture.componentRef.setInput('repo', 'me/observatory');
  if (inputs.issue !== undefined) fixture.componentRef.setInput('issue', inputs.issue);
  if (inputs.branch !== undefined) fixture.componentRef.setInput('branch', inputs.branch);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('AgentLanes', () => {
  it('shows an issue’s pipeline, a lane a run', () => {
    const element = render({ issue: 12 });

    expect(element.querySelectorAll('.bar')).toHaveLength(2);
    expect(element.querySelector('h3')?.textContent).toContain('2 runs');
  });

  it('finds a pull request’s runs from its branch alone', () => {
    expect(render({ branch: 'feat/12-thing' }).querySelectorAll('.bar')).toHaveLength(2);
  });

  it('draws nothing at all when no agent worked on the change', () => {
    expect(render({ issue: 99 }).querySelector('section')).toBeNull();
  });
});
