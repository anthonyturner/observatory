import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { INBOX_API } from './inbox-api';
import { InboxFeed } from './inbox-feed';
import { fakeInboxApi, inboxBody, inboxItemBody } from './testing/inbox-fixture';

function setUp(body: () => Observable<unknown>) {
  const fake = fakeInboxApi(body);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: INBOX_API, useValue: fake.api },
    ],
  });
  const feed = TestBed.inject(InboxFeed);
  const session = (access: string) =>
    TestBed.inject(HttpTestingController).expectOne('/api/session').flush({ access, signIn: null });
  TestBed.tick();
  return { feed, session, marked: fake.marked };
}

const TWO = inboxBody([
  inboxItemBody('1', { updatedAt: '2026-10-08T09:00:00Z' }),
  inboxItemBody('2', { updatedAt: '2026-10-08T13:00:00Z' }),
]);

describe('InboxFeed', () => {
  it('reads the inbox and counts what is unread', () => {
    const { feed } = setUp(() => of(TWO));

    expect(feed.state().status).toBe('ready');
    expect(feed.unreadCount()).toBe(2);
  });

  it('never asks for a visitor, who sees it as private', () => {
    let asked = 0;
    const { feed, session } = setUp(() => {
      asked++;
      return of(TWO);
    });
    session('visitor');
    TestBed.tick();

    expect(feed.state().status).toBe('private');
    expect(feed.unreadCount()).toBeNull();
    expect(asked).toBe(1);
  });

  it('reads a refusal as private, and anything else as unreachable', () => {
    const refused = setUp(() =>
      throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' })),
    );
    expect(refused.feed.state().status).toBe('private');

    TestBed.resetTestingModule();
    const down = setUp(() => throwError(() => new HttpErrorResponse({ status: 502 })));
    expect(down.feed.state().status).toBe('unreachable');
  });

  it('has no count when notifications could not be read', () => {
    const { feed } = setUp(() => of(inboxBody([], { status: 'no-access', note: 'scope' })));

    expect(feed.state().status).toBe('ready');
    expect(feed.unreadCount()).toBeNull();
  });

  it('takes one off the list once GitHub marked it read', () => {
    const { feed, marked } = setUp(() => of(TWO));

    feed.markRead('1').subscribe();

    expect(marked).toEqual(['1']);
    expect(feed.unreadCount()).toBe(1);
  });

  it('marks all read up to when GitHub was read, keeping what came after', () => {
    const { feed, marked } = setUp(() => of(TWO));

    feed.markAllRead().subscribe();

    expect(marked).toEqual(['all before 2026-10-08T12:00:00.000Z']);
    expect(feed.unreadCount()).toBe(1);
  });

  it('reads GitHub anew when asked', () => {
    const asked: boolean[] = [];
    const fake = fakeInboxApi();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: INBOX_API,
          useValue: {
            ...fake.api,
            read: (fresh: boolean) => {
              asked.push(fresh);
              return of(TWO);
            },
          },
        },
      ],
    });
    const feed = TestBed.inject(InboxFeed);
    TestBed.tick();

    feed.refresh();

    expect(asked).toEqual([false, true]);
  });
});
