import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AGENT_CHANGES_API } from './agent-changes-api';
import { AgentChangesState } from './agent-changes.types';
import { agentChanges } from './testing/agent-changes-fixture';

const SESSION = '11111111-1111-4111-8111-111111111111';

function setUp() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(AGENT_CHANGES_API), http: TestBed.inject(HttpTestingController) };
}

describe('AGENT_CHANGES_API', () => {
  it('asks for an agent by its ids only, and reads the answer', () => {
    const { api, http } = setUp();
    let read: AgentChangesState | undefined;

    api.changes({ session: SESSION, agentId: 'ab12' }).subscribe((state) => (read = state));
    const request = http.expectOne((each) => each.url === '/api/live-agents/changes');
    expect(request.request.params.keys()).toEqual(['session', 'agent']);
    request.flush({ generatedAt: 'now', changes: { kind: 'diff', ...agentChanges() } });

    expect(read).toEqual({ status: 'ready', changes: agentChanges() });
  });

  it('reads a 404 as the hosted site, and any other failure as unreachable', () => {
    const { api, http } = setUp();
    const reads: AgentChangesState[] = [];

    api.changes({ session: SESSION, agentId: null }).subscribe((state) => reads.push(state));
    http
      .expectOne((each) => each.url === '/api/live-agents/changes')
      .flush('', {
        status: 404,
        statusText: 'Not Found',
      });
    api.changes({ session: SESSION, agentId: null }).subscribe((state) => reads.push(state));
    http
      .expectOne((each) => each.url === '/api/live-agents/changes')
      .flush('', {
        status: 500,
        statusText: 'Server Error',
      });

    expect(reads).toEqual([{ status: 'local-only' }, { status: 'unreachable' }]);
  });

  it('finds the open pull request whose head is the branch, in the queue', () => {
    const { api, http } = setUp();
    const found: (number | null)[] = [];
    const queue = {
      generatedAt: 'now',
      repo: 'me/app',
      items: [7, 9].map((number) => ({
        number,
        title: `Change ${number}`,
        url: `https://github.com/me/app/pull/${number}`,
        bucket: 'unreviewed',
        branch: `feat/${number}`,
      })),
    };

    api.openPullOf('me/app', 'feat/9').subscribe((number) => found.push(number));
    http.expectOne((each) => each.url === '/api/queue').flush(queue);
    api.openPullOf('me/app', 'feat/1').subscribe((number) => found.push(number));
    http.expectOne((each) => each.url === '/api/queue').flush(queue);

    expect(found).toEqual([9, null]);
  });
});
