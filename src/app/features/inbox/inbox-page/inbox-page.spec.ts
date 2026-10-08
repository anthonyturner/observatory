import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { INBOX_API, InboxApi } from '../../../core/inbox/inbox-api';
import { fakeInboxApi, inboxBody, inboxItemBody } from '../../../core/inbox/testing/inbox-fixture';
import { ProjectsFeed } from '../../../core/projects/projects-feed';
import { InboxPage } from './inbox-page';

const REPORT = inboxBody([
  inboxItemBody('1', { repo: 'me/app', reason: 'review_requested' }),
  inboxItemBody('2', {
    repo: 'someone/lib',
    reason: 'mention',
    subjectType: 'Issue',
    number: 4,
    url: 'https://github.com/someone/lib/issues/4',
  }),
]);

/** Observatory charts me/app only. */
const CHARTED = signal({
  status: 'ready',
  report: { generatedAt: '2026-10-08T12:00:00Z', projects: [{ repo: 'me/app' }], directives: [] },
});

function render(body: () => Observable<unknown> = () => of(REPORT), api: Partial<InboxApi> = {}) {
  const fake = fakeInboxApi(body);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: INBOX_API, useValue: { ...fake.api, ...api } },
      { provide: ProjectsFeed, useValue: { state: CHARTED } },
    ],
  });
  const fixture = TestBed.createComponent(InboxPage);
  TestBed.tick();
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement, marked: fake.marked };
}

const rowLinks = (element: HTMLElement) =>
  Array.from(element.querySelectorAll<HTMLAnchorElement>('app-inbox-list li a'));

describe('InboxPage', () => {
  it('lists the unread by repository and reason, under the Inbox heading', () => {
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('Inbox');
    expect(element.querySelector('.stamp')?.textContent).toBe('2 unread transmissions');
    expect(
      Array.from(element.querySelectorAll('h2 .repo__name')).map((name) => name.textContent),
    ).toEqual(['me/app', 'someone/lib']);
    expect(Array.from(element.querySelectorAll('h3')).map((h) => h.textContent?.trim())).toEqual([
      'Review requested',
      'Mentioned you',
    ]);
  });

  it('opens a charted project’s pull request on its Review Queue, and anything else on GitHub', () => {
    const { element } = render();
    const [inside, away] = rowLinks(element);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    expect(inside.getAttribute('href')).toBe('/p/me/app?pr=7');
    expect(inside.hasAttribute('target')).toBe(false);
    expect(away.getAttribute('href')).toBe('https://github.com/someone/lib/issues/4');
    expect(away.getAttribute('target')).toBe('_blank');

    inside.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(navigate).toHaveBeenCalledWith('/p/me/app?pr=7');
  });

  it('marks one read and takes it off the list', () => {
    const { fixture, element, marked } = render();

    element.querySelector<HTMLButtonElement>('button.mark')?.click();
    fixture.detectChanges();

    expect(marked).toEqual(['1']);
    expect(rowLinks(element).length).toBe(1);
    expect(element.querySelector('.stamp')?.textContent).toBe('1 unread transmission');
  });

  it('marks all read, then says all is clear', () => {
    const { fixture, element, marked } = render();
    const markAll = Array.from(element.querySelectorAll<HTMLButtonElement>('.tools button')).find(
      (button) => button.textContent?.includes('Mark all read'),
    );

    markAll?.click();
    fixture.detectChanges();

    expect(marked).toEqual(['all before 2026-10-08T12:00:00.000Z']);
    expect(element.querySelector('.empty strong')?.textContent).toBe('All clear');
  });

  it('says why GitHub refused a mark, and keeps the row', () => {
    const { fixture, element } = render(undefined, {
      markRead: () => throwError(() => new Error('This is a preview. Sign in to change anything')),
    });

    element.querySelector<HTMLButtonElement>('button.mark')?.click();
    fixture.detectChanges();

    expect(element.querySelector('.refusal')?.textContent).toContain('Couldn’t mark it read');
    expect(rowLinks(element).length).toBe(2);
  });

  it('names the scope the token needs when it may not read notifications', () => {
    const { element } = render(() =>
      of(inboxBody([], { status: 'no-access', note: 'Needs the notifications or repo scope.' })),
    );

    expect(element.querySelector('.empty')?.textContent).toContain(
      'Needs the notifications or repo scope.',
    );
  });
});
