import { TestBed } from '@angular/core/testing';
import { AgentsReport } from '../../../core/agents/agents-report';
import { filterFor } from '../starmap-sky/starmap-sky';
import { SkyStar } from '../engine/sky-model';
import { AgentsPanel, agentBars, agentsSub, hours } from './agents-panel';

const report: AgentsReport = {
  since: '2026-09-20T10:00:00Z',
  attributed: 3,
  agents: [
    {
      agent: 'dev',
      basis: 'named and inferred',
      prs: [1, 2],
      opened: 2,
      merged: 1,
      open: 1,
      conflicting: 1,
      unlinked: 1,
      medianMergeHours: 6,
      medianLines: 56,
    },
  ],
};

describe('agent report cards', () => {
  it('writes durations as pr-starmap does', () => {
    expect(hours(null)).toBe('—');
    expect(hours(0.5)).toBe('30 min');
    expect(hours(6)).toBe('6.0 h');
    expect(hours(60)).toBe('2.5 days');
  });

  it('bars each outcome as a share of what the agent opened', () => {
    expect(agentBars(report.agents[0]).map((b) => [b.label, b.n, b.pct])).toEqual([
      ['merged', 1, 50],
      ['still open', 1, 50],
      ['open and conflicting', 1, 50],
      ['close no issue', 1, 50],
    ]);
  });

  it('says what the cards rest on, or how they come to be', () => {
    expect(agentsSub(report, 'en-US')).toBe(
      "3 pull requests attributed since Sep 20. Click a card to light only that agent's stars.",
    );
    expect(agentsSub(null)).toContain('No handoffs recorded yet.');
  });

  it('asks to light an agent from its card', () => {
    const fixture = TestBed.createComponent(AgentsPanel);
    fixture.componentRef.setInput('report', report);
    fixture.detectChanges();
    const lit: string[] = [];
    fixture.componentInstance.light.subscribe((agent) => lit.push(agent));

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.acard')?.click();

    expect(lit).toEqual(['dev']);
  });

  it('lights only the agent’s stars on the sky', () => {
    const star = (pr: number) => ({ item: { pr } }) as unknown as SkyStar;
    const lit = filterFor('agent:dev', [1, 2]);
    expect(lit?.(star(2))).toBe(true);
    expect(lit?.(star(3))).toBe(false);
  });
});
