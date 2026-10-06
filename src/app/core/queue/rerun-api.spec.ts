import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpRerunApi, rerunCountOf } from './rerun-api';

function setUp() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(HttpRerunApi), http: TestBed.inject(HttpTestingController) };
}

describe('rerunCountOf', () => {
  it('counts the workflow runs started again', () => {
    expect(rerunCountOf({ number: 7, runs: [101, 102] })).toBe(2);
  });

  it('refuses anything else', () => {
    expect(rerunCountOf(null)).toBeNull();
    expect(rerunCountOf({ number: 7 })).toBeNull();
  });
});

describe('HttpRerunApi', () => {
  it('asks for a rerun as a write, and answers how many runs started again', () => {
    const { api, http } = setUp();
    let count: number | null = null;

    api.rerun('me/app', 7).subscribe((answer) => (count = answer));
    const request = http.expectOne('/api/rerun');
    request.flush({ number: 7, runs: [101] });

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ repo: 'me/app', number: 7 });
    expect(request.request.headers.get('x-observatory')).toBe('1');
    expect(count).toBe(1);
  });

  it('fails with the API’s own words for a refusal', () => {
    const { api, http } = setUp();
    let message = '';

    api.rerun('me/app', 7).subscribe({ error: (error: Error) => (message = error.message) });
    http
      .expectOne('/api/rerun')
      .flush({ error: '#7 is not failing only on flaky checks' }, { status: 403, statusText: 'x' });

    expect(message).toBe('#7 is not failing only on flaky checks');
  });
});
