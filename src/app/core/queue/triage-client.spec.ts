import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TriageClient } from './triage-client';

describe('TriageClient', () => {
  it('posts the action with the header the API requires for a write', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const client = TestBed.inject(TriageClient);

    client.record('me/a', 7, { action: 'snooze', days: 7 }).subscribe();

    const request = TestBed.inject(HttpTestingController).expectOne('/api/triage');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('x-observatory')).toBe('1');
    expect(request.request.body).toEqual({ repo: 'me/a', number: 7, action: 'snooze', days: 7 });
  });
});
