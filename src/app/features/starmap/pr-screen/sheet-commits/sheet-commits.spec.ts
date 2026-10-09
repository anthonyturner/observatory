import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PullDetail, parsePullDetail } from '../../../../core/queue/pull-detail';
import { SheetCommits } from './sheet-commits';

const FIRST = 'a'.repeat(40);
const SECOND = 'b'.repeat(40);
const DIFF = 'diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-old\n+new';

const detail = parsePullDetail({
  number: 9,
  title: 'Add a thing',
  url: 'https://github.com/me/app/pull/9',
  head: 'feat/9',
  base: 'main',
  bucket: 'unlinked',
  commits: [
    { oid: 'aaaaaaa', sha: FIRST, headline: 'first', date: '2026-10-01T00:00:00Z' },
    { oid: 'bbbbbbb', sha: SECOND, headline: 'second', date: '2026-10-02T00:00:00Z' },
  ],
  commitsTotal: 2,
}) as PullDetail;

const answer = (sha: string, diff: string) => ({
  sha,
  diff,
  diffBytes: diff.length,
  diffTruncated: false,
  diffHidden: false,
});

function render() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(SheetCommits);
  fixture.componentRef.setInput('repo', 'me/app');
  fixture.componentRef.setInput('detail', detail);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const http = TestBed.inject(HttpTestingController);
  const line = (sha: string) => element.querySelector<HTMLButtonElement>(`[data-key="${sha}"]`)!;
  const click = (target: HTMLElement) => {
    target.click();
    fixture.detectChanges();
  };
  const reply = (sha: string, body: object) => {
    http.expectOne(`/api/commit?repo=me/app&sha=${sha}`).flush(body);
    fixture.detectChanges();
  };
  const button = (text: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('.act')).find((each) =>
      each.textContent?.includes(text),
    )!;
  return { fixture, element, http, line, click, reply, button };
}

describe('SheetCommits', () => {
  it('lists each commit as a closed button, newest first', () => {
    const { element, line } = render();

    const lines = Array.from(element.querySelectorAll('button.line'));
    expect(lines.map((each) => each.textContent)).toEqual([
      expect.stringContaining('second'),
      expect.stringContaining('first'),
    ]);
    expect(line(FIRST).getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a commit’s diff beneath it, reading it once clicked', () => {
    const { element, line, click, reply, fixture } = render();

    click(line(FIRST));
    expect(line(FIRST).getAttribute('aria-expanded')).toBe('true');
    expect(element.textContent).toContain('Reading this commit’s changes');
    reply(FIRST, answer(FIRST, DIFF));
    element.querySelector<HTMLButtonElement>('.dfile button')!.click();
    fixture.detectChanges();

    const controls = line(FIRST).getAttribute('aria-controls')!;
    expect(element.querySelector(`#${controls} pre .a .c`)?.textContent).toBe('new');
  });

  it('says so when a commit changes no file’s content', () => {
    const { element, line, click, reply } = render();

    click(line(SECOND));
    reply(SECOND, answer(SECOND, ''));

    expect(element.textContent).toContain('This commit changes no file’s content.');
  });

  it('offers another try and GitHub when the commit cannot be read', () => {
    const { fixture, element, http, line, click, reply, button } = render();

    click(line(FIRST));
    http
      .expectOne(`/api/commit?repo=me/app&sha=${FIRST}`)
      .flush('no', { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();
    expect(element.textContent).toContain('could not be read from GitHub');
    expect(element.querySelector('a.act')?.getAttribute('href')).toBe(
      `https://github.com/me/app/pull/9/commits/${FIRST}`,
    );
    click(button('Try again'));
    reply(FIRST, answer(FIRST, DIFF));

    expect(element.querySelector('.dfile')).not.toBeNull();
  });

  it('keeps one commit open at a time', () => {
    const { line, click, reply, http } = render();

    click(line(FIRST));
    reply(FIRST, answer(FIRST, DIFF));
    click(line(SECOND));
    reply(SECOND, answer(SECOND, DIFF));
    click(line(SECOND));

    expect(line(FIRST).getAttribute('aria-expanded')).toBe('false');
    expect(line(SECOND).getAttribute('aria-expanded')).toBe('false');
    http.verify();
  });

  it('closes the commit and puts focus back on its line', async () => {
    const { fixture, element, line, click, reply, button } = render();

    click(line(FIRST));
    reply(FIRST, answer(FIRST, DIFF));
    click(button('Close commit aaaaaaa'));
    await fixture.whenStable();

    expect(element.querySelector('.commit')).toBeNull();
    expect(document.activeElement).toBe(line(FIRST));
  });
});
