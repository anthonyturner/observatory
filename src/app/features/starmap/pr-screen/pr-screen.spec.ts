import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PrScreen } from './pr-screen';

const HEAD = 'b2b767f94b7a8acb0e88d0cc7ec9c3023b0329be';
const detail = {
  number: 572,
  title: 'fix(supabase): rate-limit the token endpoint',
  body: '## Summary\n<img src=x onerror=alert(1)> **bold** [docs](https://x.dev)',
  bodyTruncated: false,
  url: 'https://github.com/me/app/pull/572',
  isDraft: true,
  mergeable: 'MERGEABLE',
  bucket: 'unlinked',
  author: 'anthony',
  head: 'fix/569',
  base: 'main',
  headOid: HEAD,
  labels: [{ name: 'bug', color: 'd73a4a' }],
  assignees: [],
  closes: [],
  checks: [{ name: 'lint', run: 'lint', outcome: 'passed', result: 'SUCCESS', url: null }],
  reviewDecision: 'none',
  requestedReviewers: [],
  reviews: [],
  additions: 1,
  deletions: 1,
  changedFiles: 1,
  files: [{ path: 'src/a.ts', additions: 1, deletions: 1, change: 'MODIFIED' }],
  commits: [{ oid: '5645cda', headline: 'fix it', date: '2026-09-24T09:02:45Z', authors: [] }],
  commitsTotal: 1,
  diff: 'diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+new',
  diffBytes: 80,
  diffTruncated: false,
  createdAt: '2026-09-24T08:57:06Z',
  updatedAt: '2026-09-24T09:02:45Z',
  fetchedAt: '2026-09-26T10:00:00Z',
};

function render() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(PrScreen);
  fixture.componentRef.setInput('repo', 'me/app');
  fixture.componentRef.setInput('number', 572);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  const element = fixture.nativeElement as HTMLElement;
  const settle = () => {
    fixture.detectChanges();
  };
  const open = () => {
    http.expectOne('/api/pull?repo=me/app&number=572').flush(detail);
    http.expectOne('/api/edit?repo=me/app&number=572').flush(null);
    http.expectOne('/api/labels?repo=me/app').flush([{ name: 'bug', color: 'd73a4a' }]);
    settle();
  };
  const tab = (name: string) => {
    const button = Array.from(element.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (each) => each.textContent?.trim().startsWith(name),
    );
    button?.click();
    settle();
  };
  const visible = () => element.querySelector<HTMLElement>('.pane:not([hidden])');
  return { fixture, http, element, open, tab, visible, settle };
}

describe('PrScreen', () => {
  it('shows the bucket, title and route, and the description as text', () => {
    const { element, open, visible } = render();
    open();

    expect(element.querySelector('.kicker')?.textContent).toBe('Vagrans — no issue linked');
    expect(element.querySelector('h2')?.textContent).toContain('#572');
    expect(element.querySelector('.route')?.textContent).toContain('draft');
    expect(visible()?.querySelector('h3')?.textContent).toBe('Summary');
    expect(visible()?.querySelector('img')).toBeNull();
    expect(visible()?.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(visible()?.querySelector('strong')?.textContent).toBe('bold');
    expect(visible()?.querySelector('a')?.getAttribute('href')).toBe('https://x.dev');
  });

  it('counts each tab and switches between them', () => {
    const { element, open, tab, visible } = render();
    open();

    const counts = Array.from(element.querySelectorAll('.count')).map((each) => each.textContent);
    expect(counts).toEqual(['', '1', '1', '1', '', '']);
    tab('Files');
    expect(visible()?.textContent).toContain('src/a.ts');
    tab('Checks');
    expect(visible()?.textContent).toContain('success');
  });

  it('draws a diff file only when it is opened', () => {
    const { open, tab, visible, settle } = render();
    open();
    tab('Diff');

    expect(visible()?.querySelector('pre')).toBeNull();
    visible()?.querySelector<HTMLButtonElement>('.dfile button')?.click();
    settle();
    expect(visible()?.querySelector('pre .a')?.textContent).toBe('+new');
  });

  it('applies an edit, reports it, and holds newer details back until asked', () => {
    const { element, http, open, tab, visible, settle } = render();
    open();
    tab('Edit');
    const title = visible()!.querySelector<HTMLInputElement>('#ed-title')!;
    title.value = 'A better title';
    title.dispatchEvent(new Event('input'));
    settle();
    expect(visible()?.textContent).toContain('1 change ready to save: title.');
    visible()!.querySelector<HTMLButtonElement>('.primary')!.click();
    settle();

    const sent = http.expectOne('/api/edit');
    expect(sent.request.headers.get('x-observatory')).toBe('1');
    expect(sent.request.body).toEqual({
      repo: 'me/app',
      number: 572,
      changes: { title: 'A better title' },
    });
    expect(element.querySelector('.pending')?.textContent).toContain('1 change sending to GitHub');
    sent.flush({ pr: 572, status: 'applied', message: 'applied: title' });
    settle();
    expect(element.querySelector('.pending')?.textContent).toContain('saved to GitHub');

    http
      .expectOne('/api/pull?repo=me/app&number=572&fresh=1')
      .flush({ ...detail, title: 'A better title', fetchedAt: '2026-09-26T10:05:00Z' });
    settle();
    element.querySelector<HTMLButtonElement>('.newer')!.click();
    settle();
    expect(visible()!.querySelector<HTMLInputElement>('#ed-title')!.value).toBe('A better title');
  });

  it('closes on Esc, but Esc in a field only leaves the field', () => {
    const { fixture, element, open, tab, visible } = render();
    open();
    tab('Edit');
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);

    const title = visible()!.querySelector<HTMLInputElement>('#ed-title')!;
    title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closed).toBe(0);
    element.ownerDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toBe(1);
  });

  it('opens another pull request on its description, with its own badge', () => {
    const { fixture, http, open, tab, visible, settle } = render();
    open();
    tab('Files');
    fixture.componentRef.setInput('number', 58);
    settle();

    http.expectOne('/api/pull?repo=me/app&number=58');
    http.expectOne('/api/edit?repo=me/app&number=58').flush({ status: 'failed', message: 'x' });
    http.expectOne('/api/labels?repo=me/app');
    settle();
    expect(visible()?.textContent).toContain('Loading…');
    expect(fixture.nativeElement.querySelector('.pending')?.textContent).toContain('edit failed');
  });

  it('offers to fetch again when the details cannot be read', () => {
    const { http, element, settle } = render();
    http.expectOne('/api/pull?repo=me/app&number=572').flush('down', {
      status: 502,
      statusText: 'Bad Gateway',
    });
    settle();

    element.querySelector<HTMLButtonElement>('.fetchbtn')!.click();
    http.expectOne('/api/pull?repo=me/app&number=572&fresh=1').flush(detail);
    settle();
    expect(element.querySelector('.route')?.textContent).toContain('main');
  });
});
