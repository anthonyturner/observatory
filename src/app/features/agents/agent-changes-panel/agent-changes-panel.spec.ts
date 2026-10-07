import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AGENT_CHANGES_API } from '../../../core/live-agents/agent-changes-api';
import { AgentChangesState } from '../../../core/live-agents/agent-changes.types';
import { LiveAgent } from '../../../core/live-agents/live-agents.types';
import {
  agentChanges,
  fakeAgentChangesApi,
} from '../../../core/live-agents/testing/agent-changes-fixture';
import { liveAgent } from '../../../core/live-agents/testing/live-agent-fixture';
import { AgentChangesPanel, CHANGES_REFRESH_MS } from './agent-changes-panel';

const textOf = (element: Element | null | undefined): string =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

function render(
  state: AgentChangesState,
  options: { agent?: LiveAgent; openPull?: () => Observable<number | null> } = {},
) {
  let reads = 0;
  const pullsAsked: string[] = [];
  const api = fakeAgentChangesApi(() => {
    reads++;
    return of(state);
  }, options.openPull);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AGENT_CHANGES_API,
        useValue: {
          ...api,
          openPullOf: (repo: string, branch: string) => {
            pullsAsked.push(`${repo} ${branch}`);
            return api.openPullOf(repo, branch);
          },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(AgentChangesPanel);
  fixture.componentRef.setInput('agent', options.agent ?? liveAgent({ state: 'quiet' }));
  TestBed.tick();
  fixture.detectChanges();
  const panel = fixture.nativeElement as HTMLElement;
  const notes = () => [...panel.querySelectorAll('.note')].map(textOf);
  return { fixture, panel, notes, reads: () => reads, pullsAsked };
}

describe('AgentChangesPanel', () => {
  afterEach(() => vi.useRealTimers());

  it('shows the folder, the branch and what it is compared with, then the diff', () => {
    const { panel } = render({ status: 'ready', changes: agentChanges() });

    const where = [...(panel.querySelector('.where')?.children ?? [])].map(textOf);
    expect(where).toEqual([
      'E:/repos/observatory-wt-490',
      'feat/490-agents',
      'Compared with origin/main as of the last fetch.',
    ]);
    expect(textOf(panel.querySelector('app-sheet-diff .head .p'))).toBe('src/app.ts');
  });

  it('says the diff is cut short in its own words, not GitHub’s', () => {
    const { notes } = render({
      status: 'ready',
      changes: agentChanges({ diffTruncated: true }),
    });

    expect(notes()).toContain(
      'Shortened to fit. Files near the end may be missing; git diff in the folder has them all.',
    );
  });

  it('warns when the folder is the shared main checkout', () => {
    const { panel } = render({
      status: 'ready',
      changes: agentChanges({ isSharedCheckout: true, branch: 'main' }),
    });

    expect(textOf(panel.querySelector('.note.warn'))).toBe(
      'This folder is the shared main checkout. These changes may belong to another session, not this agent.',
    );
  });

  it('labels the committed changes of a folder that is gone', () => {
    const { panel } = render({
      status: 'ready',
      changes: agentChanges({ isCommittedOnly: true, readFrom: 'E:\\repos\\observatory' }),
    });

    expect(textOf(panel.querySelector('.note.gone'))).toMatch(
      /^This folder is gone, so only its committed/,
    );
  });

  it('says there are no changes in place of an empty diff', () => {
    const { panel, notes } = render({
      status: 'ready',
      changes: agentChanges({ diff: '', diffBytes: 0 }),
    });

    expect(notes()).toEqual(['No changes yet against origin/main.']);
    expect(panel.querySelector('app-sheet-diff')).toBeNull();
  });

  it('says why there is no diff, as a warning when trying again may help', () => {
    const repo = render({ status: 'problem', problem: 'not-a-repo' });
    expect(repo.notes()).toEqual([
      "This agent's folder isn't in a git repository, so there are no changes to show.",
    ]);
    expect(repo.panel.querySelector('.note.warn')).toBeNull();
    TestBed.resetTestingModule();

    const failed = render({ status: 'problem', problem: 'git-failed' });
    expect(textOf(failed.panel.querySelector('.note.warn'))).toBe(
      "Git couldn't read this folder's changes.",
    );
  });

  it('links the open pull request on its branch, found in the queue', () => {
    const { panel, pullsAsked } = render(
      { status: 'ready', changes: agentChanges() },
      { openPull: () => of(42) },
    );

    const link = panel.querySelector<HTMLAnchorElement>('a.pull');
    expect(pullsAsked).toEqual(['me/observatory feat/490-agents']);
    expect(textOf(link)).toBe('Pull request #42');
    expect(link?.getAttribute('href')).toBe('/p/me/observatory?pr=42');
  });

  it('reads again on Refresh', () => {
    const { panel, reads, fixture } = render({ status: 'ready', changes: agentChanges() });

    panel.querySelector<HTMLButtonElement>('.abtn')?.click();
    fixture.detectChanges();

    expect(reads()).toBe(2);
  });

  it('reads again every 30 seconds only while the agent works', () => {
    vi.useFakeTimers();
    const working = render(
      { status: 'ready', changes: agentChanges() },
      { agent: liveAgent({ state: 'working' }) },
    );
    vi.advanceTimersByTime(CHANGES_REFRESH_MS * 2);
    expect(working.reads()).toBe(3);
    TestBed.resetTestingModule();

    const quiet = render({ status: 'ready', changes: agentChanges() });
    vi.advanceTimersByTime(CHANGES_REFRESH_MS * 2);
    expect(quiet.reads()).toBe(1);
  });
});
