import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PAGE_LOCATION, ViewerSession } from './viewer-session';

function setUp() {
  const assigned: string[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: PAGE_LOCATION,
        useValue: { here: () => '/p/me/app?x=1', assign: (url: string) => assigned.push(url) },
      },
    ],
  });
  const session = TestBed.inject(ViewerSession);
  const answer = (body: object) =>
    TestBed.inject(HttpTestingController).expectOne('/api/session').flush(body);
  return { session, answer, assigned };
}

describe('ViewerSession', () => {
  it('behaves as this machine until the API answers', () => {
    const { session } = setUp();

    expect(session.access()).toBe('local');
    expect(session.canWrite()).toBe(true);
    expect(session.isVisitor()).toBe(false);
  });

  it('lets this machine and the signed-in owner write', () => {
    const { session, answer } = setUp();

    answer({ access: 'owner', signIn: '/api/auth/login' });

    expect(session.canWrite()).toBe(true);
    expect(session.isVisitor()).toBe(false);
  });

  it('marks a visitor read-only, with a way to sign in and come back', () => {
    const { session, answer, assigned } = setUp();

    answer({ access: 'visitor', signIn: '/api/auth/login' });

    expect(session.isVisitor()).toBe(true);
    expect(session.canWrite()).toBe(false);
    expect(session.signInUrl()).toBe('/api/auth/login?next=%2Fp%2Fme%2Fapp%3Fx%3D1');
    expect(assigned).toEqual([]);
  });

  it('sends someone who must sign in to sign in', () => {
    const { answer, assigned } = setUp();

    answer({ access: 'signed-out', signIn: '/api/auth/login' });

    expect(assigned).toEqual(['/api/auth/login?next=%2Fp%2Fme%2Fapp%3Fx%3D1']);
  });

  it('ignores an answer it does not understand, and a failed request', () => {
    const first = setUp();
    first.answer({ access: 'admin' });
    expect(first.session.canWrite()).toBe(true);

    TestBed.resetTestingModule();
    const second = setUp();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/session')
      .flush('down', { status: 502, statusText: 'Bad Gateway' });
    expect(second.session.access()).toBe('local');
    expect(second.assigned).toEqual([]);
  });
});
