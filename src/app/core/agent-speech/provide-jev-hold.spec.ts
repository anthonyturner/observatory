import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PAGE_LOCATION } from '../session/viewer-session';
import { SpokenReplies } from '../voice/spoken-replies';
import { provideJevHold } from './provide-jev-hold';

/** The real session and hold API, which the test answers as the server would. */
function setUp() {
  const isBusy = signal(false);
  TestBed.configureTestingModule({
    providers: [
      provideJevHold(),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: PAGE_LOCATION, useValue: { here: () => '/', assign: () => undefined } },
      { provide: SpokenReplies, useValue: { isBusy } },
    ],
  });
  TestBed.inject(EnvironmentInjector);
  TestBed.tick();
  const http = TestBed.inject(HttpTestingController);
  const speak = (): void => {
    isBusy.set(true);
    TestBed.tick();
  };
  const answerSession = (body: object): void => {
    http.expectOne('/api/session').flush(body);
    TestBed.tick();
  };
  return { http, speak, answerSession };
}

describe('provideJevHold', () => {
  it('sends no hold before the API has answered', () => {
    const { http, speak } = setUp();

    speak();

    http.expectNone('/api/agent-speech/hold');
  });

  it('sends no hold on the hosted site, even for the signed-in owner', () => {
    const { http, speak, answerSession } = setUp();

    answerSession({ access: 'owner', signIn: '/api/auth/login' });
    speak();

    http.expectNone('/api/agent-speech/hold');
  });

  it('holds Agent Speak once the API confirms this machine', () => {
    const { http, speak, answerSession } = setUp();

    answerSession({ access: 'local', signIn: null });
    speak();

    expect(http.expectOne('/api/agent-speech/hold').request.method).toBe('POST');
  });
});
