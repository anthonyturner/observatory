import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PullPanel } from './pull-panel';

const detail = {
  number: 58,
  title: 'Replace the facade',
  body: '<b>not bold</b>',
  url: 'https://github.com/me/a/pull/58',
  isDraft: true,
  bucket: 'failing',
  author: 'anthony',
  head: 'refactor/57',
  base: 'main',
  labels: [{ name: 'area:dashboard', color: '1d76db' }],
  closes: [57],
  checks: [
    { name: 'CI / Test', outcome: 'failed', url: 'https://github.com/x/2' },
    { name: 'CI / Build', outcome: 'passed', url: null },
  ],
  reviewDecision: 'review-required',
  requestedReviewers: ['sam'],
  reviews: [],
  additions: 96,
  deletions: 95,
  changedFiles: 4,
  createdAt: '2026-07-30T05:16:37Z',
  updatedAt: '2026-07-30T05:16:46Z',
};

function render() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(PullPanel);
  fixture.componentRef.setInput('repo', 'me/a');
  fixture.componentRef.setInput('number', 58);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  return { fixture, http, element: fixture.nativeElement as HTMLElement };
}

describe('PullPanel', () => {
  it('offers triage for what it is, and asks for the one pressed', () => {
    const { fixture, http, element } = render();
    fixture.componentRef.setInput('triage', { isSeen: true, hidden: { reason: 'dismissed' } });
    const asked: unknown[] = [];
    fixture.componentInstance.triaged.subscribe((choice) => asked.push(choice));
    http.expectOne('/api/pull?repo=me/a&number=58').flush(detail);
    fixture.detectChanges();
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('.triage button'));

    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Mark unseen', 'Restore']);
    buttons[1].click();
    expect(asked).toEqual([{ action: 'restore' }]);
  });

  it('offers snoozes and dismissal for one in the queue', () => {
    const { fixture, http, element } = render();
    fixture.componentRef.setInput('triage', { isSeen: false, hidden: null });
    http.expectOne('/api/pull?repo=me/a&number=58').flush(detail);
    fixture.detectChanges();

    expect(
      Array.from(element.querySelectorAll('.triage button')).map((button) =>
        button.textContent?.trim(),
      ),
    ).toEqual(['Mark seen', 'Snooze 1 day', 'Snooze 7 days', 'Dismiss']);
  });

  it('says it is reading, then shows the pull request', () => {
    const { fixture, http, element } = render();
    expect(element.querySelector('.state')?.textContent).toContain('Reading #58');

    http.expectOne('/api/pull?repo=me/a&number=58').flush(detail);
    fixture.detectChanges();

    expect(element.querySelector('h2')?.textContent).toContain('Replace the facade');
    expect(element.querySelector('.why')?.textContent).toContain('failure');
    expect(element.querySelector('#checks-title small')?.textContent).toBe('1 failed · 1 passed');
    expect(element.querySelectorAll('.checks li').length).toBe(1);
    expect(element.querySelector('#review-title small')?.textContent).toBe('Review required');
    expect(element.querySelector('.facts')?.textContent).toContain('#57');
  });

  it('shows the description as text, never as HTML', () => {
    const { fixture, http, element } = render();
    http.expectOne('/api/pull?repo=me/a&number=58').flush(detail);
    fixture.detectChanges();

    const body = element.querySelector('.body');
    expect(body?.textContent).toBe('<b>not bold</b>');
    expect(body?.querySelector('b')).toBeNull();
  });

  it('closes from its button', () => {
    const { fixture, element } = render();
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);

    element.querySelector<HTMLButtonElement>('.close')?.click();

    expect(closed).toBe(1);
  });
});
