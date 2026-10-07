import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { LIVE_AGENTS_API } from '../../../core/live-agents/live-agents-api';
import { LiveAgentsState } from '../../../core/live-agents/live-agents.types';
import { fakeLiveAgentsApi, liveAgent } from '../../../core/live-agents/testing/live-agent-fixture';
import { LiveAgentsLink } from './live-agents-link';

function render(state: LiveAgentsState, repo: string | null = null) {
  const list = (): Observable<LiveAgentsState> => of(state);
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: LIVE_AGENTS_API, useValue: fakeLiveAgentsApi(list) }],
  });
  const fixture = TestBed.createComponent(LiveAgentsLink);
  fixture.componentRef.setInput('label', 'Agent sessions');
  fixture.componentRef.setInput('repo', repo);
  TestBed.tick();
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('a');
}

describe('LiveAgentsLink', () => {
  const agents = [
    liveAgent({ state: 'waiting' }),
    liveAgent({ repo: 'me/other' }),
    liveAgent({ repo: 'me/other' }),
  ];

  it('leads to the agents, counting them all and naming how many wait on you', () => {
    const link = render({ status: 'ready', agents });

    expect(link?.getAttribute('href')).toBe('/agents');
    expect(link?.querySelector('.count')?.textContent?.trim()).toBe('3');
    expect(link?.getAttribute('aria-label')).toBe('Agent sessions, 3 running, 1 waiting for you');
    expect(link?.hasAttribute('data-waiting')).toBe(true);
  });

  it('counts only its repository’s agents when it has one', () => {
    const link = render({ status: 'ready', agents }, 'me/other');

    expect(link?.querySelector('.count')?.textContent?.trim()).toBe('2');
    expect(link?.hasAttribute('data-waiting')).toBe(false);
  });

  it('keeps the link but hides the count when nothing is running', () => {
    const link = render({ status: 'ready', agents: [] });

    expect(link).not.toBeNull();
    expect(link?.querySelector('.count')).toBeNull();
  });

  it('hides altogether where the agents cannot be read', () => {
    expect(render({ status: 'local-only' })).toBeNull();
    TestBed.resetTestingModule();
    expect(render({ status: 'unreachable' })).toBeNull();
  });
});
