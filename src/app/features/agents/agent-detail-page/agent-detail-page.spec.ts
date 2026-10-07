import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AGENT_FEED_API } from '../../../core/live-agents/agent-feed-api';
import { AgentFeedRead } from '../../../core/live-agents/agent-feed.types';
import { AGENT_CHANGES_API } from '../../../core/live-agents/agent-changes-api';
import { LIVE_AGENTS_API } from '../../../core/live-agents/live-agents-api';
import { LiveAgentKey, OneAgentState } from '../../../core/live-agents/live-agents.types';
import {
  SESSION,
  fakeLiveAgentsApi,
  liveAgent,
} from '../../../core/live-agents/testing/live-agent-fixture';
import { fakeAgentChangesApi } from '../../../core/live-agents/testing/agent-changes-fixture';
import { AgentDetailPage } from './agent-detail-page';

const NO_ACTIVITY: AgentFeedRead = {
  status: 'ready',
  page: { events: [], next: 0, isRestart: true },
};

function render(
  state: OneAgentState,
  params: Record<string, string> = { session: SESSION },
  feed: Observable<AgentFeedRead> = of(NO_ACTIVITY),
) {
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
      { provide: AGENT_FEED_API, useValue: { feed: () => feed } },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(params)) } },
      { provide: AGENT_CHANGES_API, useValue: fakeAgentChangesApi() },
    ],
  });
  const fixture = TestBed.createComponent(AgentDetailPage);
  TestBed.tick();
  fixture.detectChanges();
  TestBed.tick();
  fixture.detectChanges();
  return { page: fixture.nativeElement as HTMLElement, asked, fixture };
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

  it('shows the agent’s changes under the Changes tab', () => {
    const { page, fixture } = render({ status: 'ready', agent: liveAgent() });
    const tab = [...page.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (each) => textOf(each) === 'Changes',
    );

    tab?.click();
    fixture.detectChanges();

    expect(tab?.getAttribute('aria-selected')).toBe('true');
    expect(page.querySelector('[role="tabpanel"] app-agent-changes-panel')).not.toBeNull();
    expect(page.querySelector('[role="tabpanel"] app-agent-activity-panel')).toBeNull();
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

  it('opens on the Activity tab, showing what the agent said and did', () => {
    const said = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Reading the header.' }] },
    };
    const { page } = render(
      { status: 'ready', agent: liveAgent() },
      undefined,
      of({
        status: 'ready',
        page: { events: [said], next: 80, isRestart: true },
      }),
    );

    const tab = page.querySelector('[role="tab"]');
    expect(textOf(tab)).toBe('Activity');
    expect(tab?.getAttribute('aria-selected')).toBe('true');
    const panel = page.querySelector('[role="tabpanel"]');
    expect(panel?.getAttribute('aria-labelledby')).toBe(tab?.id);
    expect(textOf(panel?.querySelector('.text'))).toBe('Reading the header.');
  });

  it('says the activity shows only on your own machine when the feed is not there', () => {
    const { page } = render(
      { status: 'ready', agent: liveAgent() },
      undefined,
      of({
        status: 'local-only',
      }),
    );

    expect(textOf(page.querySelector('[role="tabpanel"]'))).toContain(
      'Agents show only on your own machine.',
    );
  });
});
