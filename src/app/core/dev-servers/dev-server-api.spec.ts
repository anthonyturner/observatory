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
    expect(devServerStatusOf({ state: 'starting' })).toEqual({ state: 'starting' });
    expect(devServerStatusOf({ state: 'running', url: 'http://localhost:5173/' })).toEqual({
      state: 'running',
      url: 'http://localhost:5173/',
    });
    expect(devServerStatusOf({ state: 'failed', reason: 'No script.' })).toEqual({
      state: 'failed',
      reason: 'No script.',
    });
  });

  it('refuses anything else, including a running server with no address', () => {
    expect(devServerStatusOf(null)).toBeNull();
    expect(devServerStatusOf({ state: 'running' })).toBeNull();
    expect(devServerStatusOf({ state: 'failed', reason: '' })).toBeNull();
    expect(devServerStatusOf({ state: 'paused' })).toBeNull();
  });
});

describe('HttpDevServerApi', () => {
  it('asks where a project’s server stands', () => {
    const { api, http } = setUp();
    const seen: DevServerStatus[] = [];

    api.status('me/app').subscribe((status) => seen.push(status));
    const request = http.expectOne((each) => each.url === '/api/dev-servers');
    request.flush({ repo: 'me/app', state: 'starting' });

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('repo')).toBe('me/app');
    expect(seen).toEqual([{ state: 'starting' }]);
  });

  it('starts a server with the write header and the repo in the body', () => {
    const { api, http } = setUp();
    const seen: DevServerStatus[] = [];

    api.start('me/app').subscribe((status) => seen.push(status));
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

    api.stop('me/app').subscribe((status) => seen.push(status));
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

    api.start('me/app').subscribe((status) => seen.push(status));
    http
      .expectOne('/api/dev-servers')
      .flush({ error: 'forbidden' }, { status: 403, statusText: 'Forbidden' });

    expect(seen).toEqual([{ state: 'failed', reason: 'forbidden' }]);
  });

  it('reads an unreachable API, and an odd answer, as a failed server', () => {
    const { api, http } = setUp();
    const seen: DevServerStatus[] = [];

    api.status('me/app').subscribe((status) => seen.push(status));
    http.expectOne((each) => each.url === '/api/dev-servers').error(new ProgressEvent('error'));
    api.status('me/app').subscribe((status) => seen.push(status));
    http.expectOne((each) => each.url === '/api/dev-servers').flush('<html>');

    expect(seen.map((status) => status.state)).toEqual(['failed', 'failed']);
  });
});
