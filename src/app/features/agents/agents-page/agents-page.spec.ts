import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LIVE_AGENTS_API } from '../../../core/live-agents/live-agents-api';
import { LiveAgentsState } from '../../../core/live-agents/live-agents.types';
import {
  SESSION,
  fakeLiveAgentsApi,
  liveAgent,
} from '../../../core/live-agents/testing/live-agent-fixture';
import { AgentsPage } from './agents-page';

function render(state: LiveAgentsState) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: LIVE_AGENTS_API, useValue: fakeLiveAgentsApi(() => of(state)) },
    ],
  });
  const fixture = TestBed.createComponent(AgentsPage);
  TestBed.tick();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const textOf = (element: Element | null | undefined): string =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('AgentsPage', () => {
  it('lists each agent as one link to its page, waiting first', () => {
    const page = render({
      status: 'ready',
      agents: [
        liveAgent(),
        liveAgent({
          agentId: 'ab12',
          agent: 'ux',
          title: 'Design it',
          state: 'waiting',
          isHeadless: true,
        }),
      ],
    });
    const rows = Array.from(page.querySelectorAll<HTMLAnchorElement>('a.row'));

    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      `/agents/${SESSION}/ab12`,
      `/agents/${SESSION}`,
    ]);
    expect(textOf(rows[0].querySelector('.title'))).toBe('ux · Design it');
    expect(textOf(rows[0].querySelector('.state'))).toBe('Waiting for you');
    expect(textOf(rows[0].querySelector('.tag'))).toBe('headless (claude -p)');
    expect(textOf(rows[1].querySelector('.branch'))).toBe('feat/490-agents');
    expect(textOf(rows[1].querySelector('.tool'))).toBe('> Read src/app.ts');
    expect(textOf(rows[1].querySelector('.folder'))).toBe('…\\observatory-wt-490');
    expect(textOf(page.querySelector('.stamp'))).toBe('2 running');
  });

  it('names each row by its title, state, project and time, all real text', () => {
    const page = render({ status: 'ready', agents: [liveAgent()] });
    const row = page.querySelector('a.row');
    const named = (row?.getAttribute('aria-labelledby') ?? '')
      .split(' ')
      .map((id) => textOf(page.querySelector(`[id="${id}"]`)));

    expect(named.slice(0, 3)).toEqual(['Build the agents list', 'Working', 'observatory']);
    expect(named[3]).not.toBe('');
    expect(textOf(page.querySelector('[role="status"]'))).toBe('1 agent running.');
  });

  it('says so when no session is running', () => {
    const page = render({ status: 'ready', agents: [] });

    expect(textOf(page.querySelector('.note'))).toContain(
      'No Claude Code sessions are running on this machine.',
    );
  });

  it('says agents show only on your own machine, on the hosted site', () => {
    const page = render({ status: 'local-only' });

    expect(textOf(page)).toContain('Agents show only on your own machine.');
    expect(page.querySelector('a.row')).toBeNull();
  });

  it('offers to try again when the API does not answer', () => {
    const page = render({ status: 'unreachable' });

    expect(textOf(page.querySelector('.note.warn button'))).toBe('Try again');
  });
});
