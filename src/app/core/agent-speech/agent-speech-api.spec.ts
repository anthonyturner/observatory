import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpAgentSpeechApi } from './agent-speech-api';

function setUp() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(HttpAgentSpeechApi), http: TestBed.inject(HttpTestingController) };
}

describe('HttpAgentSpeechApi', () => {
  it('asks whether Agent Speak is busy with the page’s own header', () => {
    const { api, http } = setUp();
    const answers: boolean[] = [];

    api.isBusy().subscribe((isBusy) => answers.push(isBusy));
    const request = http.expectOne('/api/agent-speech');
    request.flush({ busy: true, speaking: true, paused: false, queued: false });

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('x-observatory')).toBe('1');
    expect(answers).toEqual([true]);
  });

  it('reads a failure, or an answer it does not know, as not busy', () => {
    const { api, http } = setUp();
    const answers: boolean[] = [];

    api.isBusy().subscribe((isBusy) => answers.push(isBusy));
    http.expectOne('/api/agent-speech').flush(null, { status: 404, statusText: 'No' });
    api.isBusy().subscribe((isBusy) => answers.push(isBusy));
    http.expectOne('/api/agent-speech').flush({ busy: 'yes' });

    expect(answers).toEqual([false, false]);
  });

  it('renews a hold by posting its token, and releases it by deleting it', () => {
    const { api, http } = setUp();
    const settled: string[] = [];

    api.renew('tab-1').subscribe(() => settled.push('renewed'));
    const renewal = http.expectOne('/api/agent-speech/hold');
    renewal.flush(null);
    api.release('tab-1').subscribe(() => settled.push('released'));
    const release = http.expectOne((each) => each.url === '/api/agent-speech/hold');
    release.flush(null, { status: 500, statusText: 'Down' });

    expect(renewal.request.method).toBe('POST');
    expect(renewal.request.body).toEqual({ token: 'tab-1' });
    expect(renewal.request.headers.get('x-observatory')).toBe('1');
    expect(release.request.method).toBe('DELETE');
    expect(release.request.params.get('token')).toBe('tab-1');
    expect(release.request.headers.get('x-observatory')).toBe('1');
    expect(settled).toEqual(['renewed', 'released']);
  });
});
