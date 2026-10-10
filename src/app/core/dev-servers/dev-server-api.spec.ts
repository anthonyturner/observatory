import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpDevServerApi, devServerStatusOf } from './dev-server-api';
import { DevServerStatus } from './dev-server.types';

function setUp() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(HttpDevServerApi), http: TestBed.inject(HttpTestingController) };
}

describe('devServerStatusOf', () => {
  it('reads each state', () => {
    expect(devServerStatusOf({ repo: 'me/app', state: 'stopped' })).toEqual({ state: 'stopped' });
    expect(devServerStatusOf({ state: 'starting' })).toEqual({
      state: 'starting',
      phase: 'starting',
    });
    for (const phase of ['fetching', 'installing', 'starting']) {
      expect(devServerStatusOf({ state: 'starting', phase })).toEqual({ state: 'starting', phase });
    }
    expect(devServerStatusOf({ state: 'starting', phase: 'dancing' })).toEqual({
      state: 'starting',
      phase: 'starting',
    });
    expect(devServerStatusOf({ state: 'running', url: 'http://localhost:5173/' })).toEqual({
      state: 'running',
      url: 'http://localhost:5173/',
    });
    expect(devServerStatusOf({ state: 'failed', reason: 'No script.' })).toEqual({
      state: 'failed',
      reason: 'No script.',
    });
    expect(devServerStatusOf({ state: 'unavailable', reason: 'No checkout.' })).toEqual({
      state: 'unavailable',
      reason: 'No checkout.',
    });
  });

  it('refuses anything else, including a running server with no address', () => {
    expect(devServerStatusOf(null)).toBeNull();
    expect(devServerStatusOf({ state: 'running' })).toBeNull();
    expect(devServerStatusOf({ state: 'running', url: 'javascript:alert(1)' })).toBeNull();
    expect(devServerStatusOf({ state: 'running', url: 'file:///etc/passwd' })).toBeNull();
    expect(devServerStatusOf({ state: 'failed', reason: '' })).toBeNull();
    expect(devServerStatusOf({ state: 'unavailable' })).toBeNull();
    expect(devServerStatusOf({ state: 'checking' })).toBeNull();
    expect(devServerStatusOf({ state: 'paused' })).toBeNull();
  });
});

describe('HttpDevServerApi', () => {
  it('asks where a project’s server stands', () => {
    const { api, http } = setUp();
    const seen: DevServerStatus[] = [];

    api.status({ repo: 'me/app' }).subscribe((status) => seen.push(status));
    const request = http.expectOne((each) => each.url === '/api/dev-servers');
    request.flush({ repo: 'me/app', state: 'starting' });

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('repo')).toBe('me/app');
    expect(seen).toEqual([{ state: 'starting', phase: 'starting' }]);
  });

  it('starts a server with the write header and the repo in the body', () => {
    const { api, http } = setUp();
    const seen: DevServerStatus[] = [];

    api.start({ repo: 'me/app' }).subscribe((status) => seen.push(status));
    const request = http.expectOne('/api/dev-servers');
    request.flush({ state: 'running', url: 'http://localhost:5173/' });

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('x-observatory')).toBe('1');
    expect(request.request.body).toEqual({ repo: 'me/app' });
    expect(seen).toEqual([{ state: 'running', url: 'http://localhost:5173/' }]);
  });

  it('stops a server with the write header', () => {
    const { api, http } = setUp();
    const seen: DevServerStatus[] = [];

    api.stop({ repo: 'me/app' }).subscribe((status) => seen.push(status));
    const request = http.expectOne((each) => each.url === '/api/dev-servers');
    request.flush({ state: 'stopped' });

    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('x-observatory')).toBe('1');
    expect(request.request.params.get('repo')).toBe('me/app');
    expect(seen).toEqual([{ state: 'stopped' }]);
  });

  it('reads a refusal as a failed server with the API’s words, never as an error', () => {
    const { api, http } = setUp();
    const seen: DevServerStatus[] = [];

    api.start({ repo: 'me/app' }).subscribe((status) => seen.push(status));
    http
      .expectOne('/api/dev-servers')
      .flush({ error: 'forbidden' }, { status: 403, statusText: 'Forbidden' });

    expect(seen).toEqual([{ state: 'failed', reason: 'forbidden' }]);
  });

  it('reads an unreachable API, and an odd answer, as a failed server', () => {
    const { api, http } = setUp();
    const seen: DevServerStatus[] = [];

    api.status({ repo: 'me/app' }).subscribe((status) => seen.push(status));
    http.expectOne((each) => each.url === '/api/dev-servers').error(new ProgressEvent('error'));
    api.status({ repo: 'me/app' }).subscribe((status) => seen.push(status));
    http.expectOne((each) => each.url === '/api/dev-servers').flush('<html>');

    expect(seen.map((status) => status.state)).toEqual(['failed', 'failed']);
  });

  it('names a pull request by its number in every call', () => {
    const { api, http } = setUp();
    const target = { repo: 'me/app', pull: 12 };

    api.status(target).subscribe();
    const status = http.expectOne((each) => each.url === '/api/dev-servers');
    status.flush({ state: 'stopped' });
    api.start(target).subscribe();
    const start = http.expectOne('/api/dev-servers');
    start.flush({ state: 'starting', phase: 'fetching' });
    api.stop(target).subscribe();
    const stop = http.expectOne((each) => each.url === '/api/dev-servers');
    stop.flush({ state: 'stopped' });

    expect(status.request.params.get('repo')).toBe('me/app');
    expect(status.request.params.get('pull')).toBe('12');
    expect(start.request.body).toEqual({ repo: 'me/app', pull: 12 });
    expect(stop.request.params.get('pull')).toBe('12');
    expect(stop.request.headers.get('x-observatory')).toBe('1');
  });

  it('sends no pull request for the project’s own server', () => {
    const { api, http } = setUp();

    api.status({ repo: 'me/app' }).subscribe();
    const status = http.expectOne((each) => each.url === '/api/dev-servers');
    status.flush({ state: 'stopped' });

    expect(status.request.params.has('pull')).toBe(false);
  });
});
