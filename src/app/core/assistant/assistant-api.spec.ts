import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ASSISTANT_API, AssistantAbsent } from './assistant-api';

function setUp() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(ASSISTANT_API), http: TestBed.inject(HttpTestingController) };
}

describe('HttpAssistantApi', () => {
  it('posts a request with the header the API requires for a write', async () => {
    const { api, http } = setUp();

    const replied = api.route({ text: 'refresh' });
    const request = http.expectOne('/api/route');
    request.flush({ via: 'keyword', tier: 1, op: 'refresh' });

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('x-observatory')).toBe('1');
    expect(request.request.body).toEqual({ text: 'refresh' });
    expect(await replied).toEqual(expect.objectContaining({ tier: 1, op: 'refresh' }));
  });

  it('takes a 403 or a 404 as no assistant on this site', async () => {
    const { api, http } = setUp();

    const refused = api.status();
    http
      .expectOne('/api/route')
      .flush({ error: 'forbidden' }, { status: 403, statusText: 'Forbidden' });
    await expect(refused).rejects.toBeInstanceOf(AssistantAbsent);

    const missing = api.status();
    http
      .expectOne('/api/route')
      .flush({ error: 'not found' }, { status: 404, statusText: 'Not Found' });
    await expect(missing).rejects.toBeInstanceOf(AssistantAbsent);
  });

  it('rejects an answer that is not the router’s', async () => {
    const { api, http } = setUp();

    const status = api.status();
    http.expectOne('/api/route').flush({ hello: 'world' });

    await expect(status).rejects.toThrow('Not an answer');
  });
});
