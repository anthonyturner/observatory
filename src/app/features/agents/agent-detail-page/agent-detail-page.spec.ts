import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LIVE_AGENTS_API } from '../../../core/live-agents/live-agents-api';
import { LiveAgentKey, OneAgentState } from '../../../core/live-agents/live-agents.types';
import {
  SESSION,
  fakeLiveAgentsApi,
  liveAgent,
} from '../../../core/live-agents/testing/live-agent-fixture';
import { AgentDetailPage } from './agent-detail-page';

function render(state: OneAgentState, params: Record<string, string> = { session: SESSION }) {
  const asked: LiveAgentKey[] = [];
  const api = fakeLiveAgentsApi(undefined, () => of(state));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: LIVE_AGENTS_API,
        useValue: {
          ...api,
          one: (key: LiveAgentKey) => {
            asked.push(key);
            return api.one(key);
          },
        },
      },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(params)) } },
    ],
  });
  const fixture = TestBed.createComponent(AgentDetailPage);
  TestBed.tick();
  fixture.detectChanges();
  return { page: fixture.nativeElement as HTMLElement, asked };
}

const textOf = (element: Element | null | undefined): string =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('AgentDetailPage', () => {
  it('asks for the agent its address names, and shows its header', () => {
    const agent = liveAgent({ agentId: 'ab12', agent: 'ux', title: 'Design it' });
    const { page, asked } = render(
      { status: 'ready', agent },
      { session: SESSION, agentId: 'ab12' },
    );

    expect(asked).toEqual([{ session: SESSION, agentId: 'ab12' }]);
    expect(textOf(page.querySelector('.kicker'))).toBe('observatory · subagent ux');
    expect(textOf(page.querySelector('h1'))).toBe('Design it');
    expect(textOf(page.querySelector('.state'))).toBe('Working');
    expect(textOf(page.querySelector('.route code'))).toBe('feat/490-agents');
    expect(page.querySelector('.banner')).toBeNull();
  });

  it('opens an agent that has stopped, saying it is not running', () => {
    const { page } = render({ status: 'ready', agent: liveAgent({ state: 'not-running' }) });

    expect(textOf(page.querySelector('.banner'))).toMatch(/^This session isn't running\./);
  });

  it('says so when no session has that address', () => {
    const { page } = render({ status: 'ready', agent: null });

    expect(textOf(page.querySelector('.note'))).toContain('No session on this machine');
  });

  it('says agents show only on your own machine, on the hosted site', () => {
    const { page } = render({ status: 'local-only' });

    expect(textOf(page)).toContain('Agents show only on your own machine.');
  });
});
