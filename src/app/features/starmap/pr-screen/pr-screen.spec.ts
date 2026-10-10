import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ViewerSession } from '../../../core/session/viewer-session';
import { PrScreen } from './pr-screen';

const HEAD = 'b2b767f94b7a8acb0e88d0cc7ec9c3023b0329be';
const detail = {
  number: 572,
  title: 'fix(supabase): rate-limit the token endpoint',
  body: '## Summary\n<img src=x onerror=alert(1)> **bold** [docs](https://x.dev)',
  bodyTruncated: false,
  url: 'https://github.com/me/app/pull/572',
  state: 'open',
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
  commits: [
    {
      oid: '5645cda',
      sha: '5645cda',
      headline: 'fix it',
      date: '2026-09-24T09:02:45Z',
      authors: [],
    },
  ],
  commitsTotal: 1,
  diff: 'diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+new',
  diffBytes: 80,
  diffTruncated: false,
  createdAt: '2026-09-24T08:57:06Z',
  updatedAt: '2026-09-24T09:02:45Z',
  fetchedAt: '2026-09-26T10:00:00Z',
};

function render(canWrite = true) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      ...(canWrite ? [] : [{ provide: ViewerSession, useValue: { canWrite: signal(false) } }]),
    ],
  });
  const fixture = TestBed.createComponent(PrScreen);
  fixture.componentRef.setInput('repo', 'me/app');
  fixture.componentRef.setInput('number', 572);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  const element = fixture.nativeElement as HTMLElement;
  const settle = () => {
    fixture.detectChanges();
  };
  const open = (shown: object = detail) => {
    http.expectOne('/api/pull?repo=me/app&number=572').flush(shown);
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
  const box = () => element.querySelector<HTMLElement>('app-merge-box')!;
  const press = (selector: string) => {
    box().querySelector<HTMLButtonElement>(selector)!.click();
    settle();
  };
  return { fixture, http, element, open, tab, visible, settle, box, press };
}

const MERGED_RECORD = {
  pr: 572,
  status: 'applied',
  message: 'applied: merge',
  changes: { merge: { method: 'squash', headOid: HEAD } },
  applied: ['merge'],
  appliedAt: '2026-09-26T10:01:00Z',
};

describe('PrScreen', () => {
  beforeEach(() => localStorage.clear());

  it('shows the bucket, title and route, and the description as text', () => {
    const { element, open, visible } = render();
    open();

    expect(element.querySelector('.kicker')?.textContent).toBe(
      'Pull request · Vagrans — no issue linked',
    );
    expect(element.querySelector('h2')?.textContent).toContain('#572');
    expect(element.querySelector('.route')?.textContent).toContain('draft');
    expect(visible()?.querySelector('h3')?.textContent).toBe('Summary');
    expect(visible()?.querySelector('img')).toBeNull();
    expect(visible()?.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(visible()?.querySelector('strong')?.textContent).toBe('bold');
    expect(visible()?.querySelector('a')?.getAttribute('href')).toBe('https://x.dev');
  });

  it('shows the head’s preview deployment and links its site, read when the screen opens', () => {
    const { http, open, visible, settle } = render();
    open();
    http.expectOne(`/api/deployments/preview?repo=me/app&sha=${HEAD}`).flush({
      repo: 'me/app',
      sha: HEAD,
      deployments: [
        {
          id: 9,
          environment: 'Preview',
          sha: HEAD,
          ref: null,
          creator: 'vercel[bot]',
          createdAt: '2026-09-24T09:03:00Z',
          outcome: 'ready',
          description: 'Deployment has completed',
          url: 'https://app-9.vercel.app',
          logUrl: 'https://app-9.vercel.app',
          commitUrl: `https://github.com/me/app/commit/${HEAD}`,
        },
      ],
    });
    settle();

    const preview = visible()?.querySelector('app-sheet-preview');
    expect(preview?.textContent).toContain('Preview Ready');
    expect(preview?.querySelectorAll('a').length).toBe(1);
    expect(preview?.querySelector('a')?.getAttribute('href')).toBe('https://app-9.vercel.app');
  });

  it('is read-only for a viewer who may not write: no Edit tab, merge box or crew', () => {
    const { element, http, settle } = render(false);
    http.expectOne('/api/pull?repo=me/app&number=572').flush(detail);
    settle();

    const tabs = Array.from(element.querySelectorAll('[role="tab"]'), (each) =>
      each.textContent?.trim(),
    );
    expect(tabs.some((name) => name?.startsWith('Edit'))).toBe(false);
    expect(tabs.length).toBe(5);
    expect(element.querySelector('app-sheet-editor')).toBeNull();
    expect(element.querySelector('app-merge-box')).toBeNull();
    expect(element.querySelector('app-crew-control')).toBeNull();
    http.expectNone('/api/edit?repo=me/app&number=572');
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
    expect(visible()?.querySelector('pre .a .c')?.textContent).toBe('new');
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

  it('reports the head it shows as looked at, once per head, and only while open', () => {
    const { fixture, http, open, settle } = render();
    const looked: string[] = [];
    fixture.componentInstance.looked.subscribe((sha) => looked.push(sha));
    open();
    fixture.componentInstance['refresh']();
    http
      .expectOne('/api/pull?repo=me/app&number=572&fresh=1')
      .flush({ ...detail, fetchedAt: 'later' });
    fixture.componentInstance['showNewer']();
    settle();

    expect(looked).toEqual([HEAD]);
  });

  it('reports no look at a pull request that is merged', () => {
    const { fixture, open } = render();
    const looked: string[] = [];
    fixture.componentInstance.looked.subscribe((sha) => looked.push(sha));
    open({ ...detail, state: 'merged' });

    expect(looked).toEqual([]);
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

  it('shows the merge box on every tab, holding a draft back with the reason', () => {
    const { box, open, tab } = render();
    open();

    expect(box().textContent).toContain('Still a draft');
    expect(box().textContent).toContain('1 check passed');
    expect(box().textContent).toContain('Mark it ready for review to merge.');
    expect(box().querySelector<HTMLButtonElement>('.main')!.disabled).toBe(true);
    tab('Files');
    expect(box().querySelector('.ready')?.textContent).toContain('Ready for review');
  });

  it('marks a draft ready from the merge box, and lets it merge straight after', () => {
    const { box, http, open, press, settle } = render();
    open();
    press('.ready');

    const sent = http.expectOne('/api/edit');
    expect(sent.request.body.changes).toEqual({ ready: true });
    sent.flush({ ...MERGED_RECORD, changes: { ready: true }, applied: ['ready'] });
    http.expectOne('/api/pull?repo=me/app&number=572&fresh=1');
    settle();
    expect(box().querySelector('.ready')).toBeNull();
    expect(box().querySelector<HTMLButtonElement>('.main')!.disabled).toBe(false);
  });

  it('merges only after a confirm, pinned to the commit seen', () => {
    const { box, http, open, press } = render();
    open({ ...detail, isDraft: false });

    expect(box().querySelector('.main')?.textContent).toContain('Squash and merge');
    press('.main');
    expect(box().querySelector('.confirm')?.textContent).toContain('Confirm squash and merge');
    http.expectNone('/api/edit');
    press('.confirm');

    const sent = http.expectOne('/api/edit');
    expect(sent.request.body.changes).toEqual({ merge: { method: 'squash', headOid: HEAD } });
    sent.flush(MERGED_RECORD);
    http.expectOne('/api/pull?repo=me/app&number=572&fresh=1');
  });

  it('cannot send a second merge, before or after GitHub answers', () => {
    const { box, element, http, open, press, settle } = render();
    open({ ...detail, isDraft: false });
    press('.main');
    const confirm = box().querySelector<HTMLButtonElement>('.confirm')!;
    confirm.click();
    confirm.click();
    settle();

    http.expectOne('/api/edit').flush(MERGED_RECORD);
    settle();
    expect(box().querySelector('.ending')?.textContent).toBe('Merged ✓ via squash');
    expect(box().querySelector('button')).toBeNull();

    http
      .expectOne('/api/pull?repo=me/app&number=572&fresh=1')
      .flush({ ...detail, isDraft: false, fetchedAt: '2026-09-26T10:02:00Z' });
    settle();
    element.querySelector<HTMLButtonElement>('.newer')!.click();
    settle();
    expect(box().querySelector('button')).toBeNull();
    http.expectNone('/api/edit');
  });

  it('shows a pull request GitHub says is merged or closed without any merge button', () => {
    const { box, open } = render();
    open({ ...detail, state: 'closed' });

    expect(box().querySelector('.ending')?.textContent).toBe('Closed without merging');
    expect(box().querySelector('button')).toBeNull();
  });

  it('says why a merge did not happen, and offers it again', () => {
    const { box, http, open, press, settle } = render();
    open({ ...detail, isDraft: false });
    press('.main');
    press('.confirm');

    http.expectOne('/api/edit').flush({
      ...MERGED_RECORD,
      status: 'failed',
      message: 'not merged: the branch conflicts with its base',
      applied: [],
    });
    http.expectOne('/api/pull?repo=me/app&number=572&fresh=1');
    settle();
    expect(box().querySelector('[role="alert"]')?.textContent).toContain('conflicts');
    expect(box().querySelector<HTMLButtonElement>('.main')!.disabled).toBe(false);
  });

  it('cancels a confirm on Esc and stays open', () => {
    const { fixture, box, open, press, settle } = render();
    open({ ...detail, isDraft: false });
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    press('.main');

    box()
      .querySelector('.confirm')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    settle();
    expect(closed).toBe(0);
    expect(box().querySelector('.confirm')).toBeNull();
  });

  it('remembers the method picked from the menu', () => {
    const { box, open, press, settle } = render();
    open({ ...detail, isDraft: false });
    press('.caret');
    const rebase = Array.from(box().querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
    rebase[2].click();
    settle();

    expect(box().querySelector('.main')?.textContent).toContain('Rebase and merge');
    expect(localStorage.getItem('observatory.merge-method')).toBe('rebase');
  });

  it('keeps merging out of the Edit tab', () => {
    const { open, tab, visible } = render();
    open();
    tab('Edit');

    expect(visible()?.querySelector('#ed-merge, #ed-confirm, input[type="checkbox"]')).toBeNull();
  });
});
