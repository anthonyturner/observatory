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
      // A review run from main names only the pull request.
      runEndingAt('qa', 0.5, 8, { agent: 'qa', branch: 'main', pull: 40 }),
    ],
  },
};

interface Inputs {
  readonly issue?: number | null;
  readonly branch?: string | null;
  readonly pull?: number | null;
  readonly pulls?: readonly number[];
}

function render(inputs: Inputs) {
  TestBed.configureTestingModule({
    providers: [{ provide: AGENT_USAGE_READ, useValue: () => of(READY) }],
  });
  const fixture = TestBed.createComponent(AgentLanes);
  fixture.componentRef.setInput('repo', 'me/observatory');
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('AgentLanes', () => {
  it('shows an issue’s pipeline, a lane a run', () => {
    const element = render({ issue: 12 });

    expect(element.querySelectorAll('.bar')).toHaveLength(2);
    expect(element.querySelector('h3')?.textContent).toContain('2 runs');
  });

  it('shows a pull request’s pipeline from its branch, with the review that names it', () => {
    expect(render({ branch: 'feat/12-thing', pull: 40 }).querySelectorAll('.bar')).toHaveLength(3);
  });

  it('shows an issue’s pipeline with the reviews of its pull requests', () => {
    expect(render({ issue: 12, pulls: [40] }).querySelectorAll('.bar')).toHaveLength(3);
  });

  it('draws nothing at all when no agent worked on the change', () => {
    expect(render({ issue: 99 }).querySelector('section')).toBeNull();
  });
});
