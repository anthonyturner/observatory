import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RunsApiError } from '../runs/runs-api';
import { StartRequest } from '../runs/runs.types';
import { HttpCrewApi, startRequestOf } from './crew-api';

const PROPOSAL = {
  prompt: 'Observatory crew ship for me/app#7: update-branch',
  run: {
    token: 't-1',
    folder: 'E:/repos/app',
    name: 'app',
    expiresAt: 5,
    limitMs: 9,
    command: 'claude -p',
  },
};

function setUp() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(HttpCrewApi), http: TestBed.inject(HttpTestingController) };
}

describe('startRequestOf', () => {
  it('takes the runner’s start request from a crew’s proposal, word for word', () => {
    expect(startRequestOf(PROPOSAL)).toEqual({
      token: 't-1',
      prompt: PROPOSAL.prompt,
      folder: 'E:/repos/app',
    });
  });

  it('refuses anything else', () => {
    expect(startRequestOf(null)).toBeNull();
    expect(startRequestOf({ prompt: 'x' })).toBeNull();
    expect(startRequestOf({ ...PROPOSAL, run: { ...PROPOSAL.run, token: 3 } })).toBeNull();
  });
});

describe('HttpCrewApi', () => {
  it('asks whether a crew can be sent, reading any failure as no', () => {
    const { api, http } = setUp();
    const answers: boolean[] = [];

    api.isAvailable().subscribe((answer) => answers.push(answer));
    http.expectOne('/api/crew').flush({ isAvailable: true });
    api.isAvailable().subscribe((answer) => answers.push(answer));
    http.expectOne('/api/crew').flush(null, { status: 404, statusText: 'Not Found' });

    expect(answers).toEqual([true, false]);
  });

  it('proposes a crew with the write header', () => {
    const { api, http } = setUp();
    const requests: StartRequest[] = [];

    api.propose('me/app', 7).subscribe((request) => requests.push(request));
    const sent = http.expectOne('/api/crew');
    sent.flush(PROPOSAL);

    expect(sent.request.method).toBe('POST');
    expect(sent.request.body).toEqual({ repo: 'me/app', number: 7 });
    expect(sent.request.headers.get('x-observatory')).toBe('1');
    expect(requests).toHaveLength(1);
  });

  it('passes on the API’s own words for a refusal', () => {
    const { api, http } = setUp();
    let refusal: unknown = null;

    api.propose('me/app', 7).subscribe({ error: (error: unknown) => (refusal = error) });
    http.expectOne('/api/crew').flush(
      { error: 'only a conflicted or failing pull request can be sent a crew' },
      {
        status: 403,
        statusText: 'Forbidden',
      },
    );

    expect(refusal).toBeInstanceOf(RunsApiError);
    expect((refusal as RunsApiError).status).toBe(403);
    expect((refusal as RunsApiError).message).toContain('conflicted or failing');
  });
});
