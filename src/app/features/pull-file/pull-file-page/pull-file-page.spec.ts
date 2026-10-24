import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PullFilePage } from './pull-file-page';

const SHA = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const TEXT = ['one', 'two', 'THREE', 'four', 'five', 'six', 'SEVEN', 'eight', 'nine', 'TEN'].join(
  '\n',
);
const PATCH = [
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -2,3 +2,3 @@',
  ' two',
  '-three',
  '+THREE',
  ' four',
  '@@ -6,5 +6,5 @@',
  ' six',
  '-seven',
  '+SEVEN',
  ' eight',
  ' nine',
  '-ten',
  '+TEN',
].join('\n');
const URL_OF = (sha: string, path = 'src/a.ts') =>
  `/api/pull-file?repo=me/app&number=7&sha=${sha}&path=${path}`;

const answer = (extra: Record<string, unknown> = {}) => ({
  path: 'src/a.ts',
  sha: SHA,
  headOid: SHA,
  state: 'shown',
  text: TEXT,
  bytes: TEXT.length,
  patch: PATCH,
  changesUnavailable: false,
  githubUrl: `https://github.com/me/app/blob/${SHA}/src/a.ts`,
  fetchedAt: '2026-10-24T00:00:00Z',
  ...extra,
});

async function open(address = `/p/me/app/pull/7/file?sha=${SHA}&path=src%2Fa.ts`) {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'p/:owner/:repo/pull/:number/file', component: PullFilePage }]),
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(address, PullFilePage);
  const http = TestBed.inject(HttpTestingController);
  const element = harness.routeNativeElement as HTMLElement;
  const text = (selector: string) =>
    element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const button = (label: string) =>
    [...element.querySelectorAll('button')].find((each) => each.textContent?.trim() === label)!;
  const click = (target: HTMLElement) => {
    target.click();
    harness.detectChanges();
  };
  const codeLines = () =>
    [...element.querySelectorAll<HTMLElement>('pre > span')].map((row) => ({
      kind: row.className,
      code: row.querySelector('.c')?.textContent,
    }));
  const scrolledTo = () =>
    vi.mocked(Element.prototype.scrollIntoView).mock.contexts.at(-1) as HTMLElement | undefined;
  return { harness, http, element, text, button, click, codeLines, scrolledTo };
}

describe('PullFilePage', () => {
  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it('shows the whole file with the added lines marked and each removed line before its place', async () => {
    const { harness, http, codeLines } = await open();

    http.expectOne(URL_OF(SHA)).flush(answer());
    harness.detectChanges();

    expect(codeLines().map((line) => `${line.kind}|${line.code}`)).toEqual([
      '|one',
      '|two',
      'd|three',
      'a|THREE',
      '|four',
      '|five',
      '|six',
      'd|seven',
      'a|SEVEN',
      '|eight',
      '|nine',
      'd|ten',
      'a|TEN',
    ]);
  });

  it('brings the first change into view, then steps through them one at a time', async () => {
    const { harness, http, text, button, click, codeLines, scrolledTo } = await open();
    http.expectOne(URL_OF(SHA)).flush(answer());
    harness.detectChanges();
    const rows = () => [...harness.routeNativeElement!.querySelectorAll('pre > span')];

    expect(text('.count')).toBe('Change 1 of 3');
    expect(scrolledTo()).toBe(rows()[2]);
    expect(button('Previous').disabled).toBe(true);
    expect(button('Next').disabled).toBe(false);

    click(button('Next'));
    expect(text('.count')).toBe('Change 2 of 3');
    expect(scrolledTo()).toBe(rows()[7]);
    expect(button('Previous').disabled).toBe(false);

    click(button('Next'));
    expect(text('.count')).toBe('Change 3 of 3');
    expect(scrolledTo()).toBe(rows()[11]);
    expect(button('Next').disabled).toBe(true);
    expect(codeLines()).toHaveLength(13);
  });

  it('disables both steps for one change, and says there is nothing to step through for none', async () => {
    const one = await open();
    one.http.expectOne(URL_OF(SHA)).flush(
      answer({
        text: 'a\nB',
        patch: 'diff --git a/src/a.ts b/src/a.ts\n@@ -1,2 +1,2 @@\n a\n-b\n+B',
      }),
    );
    one.harness.detectChanges();
    expect(one.text('.count')).toBe('Change 1 of 1');
    expect([one.button('Previous').disabled, one.button('Next').disabled]).toEqual([true, true]);
    TestBed.resetTestingModule();

    const none = await open();
    none.http.expectOne(URL_OF(SHA)).flush(answer({ patch: '' }));
    none.harness.detectChanges();
    expect(none.text('.count')).toBe('No changes to show');
    expect([none.button('Previous').disabled, none.button('Next').disabled]).toEqual([true, true]);
  });

  it('says the changes are not available, rather than that there are none, when GitHub would not give them', async () => {
    const { harness, http, text, codeLines } = await open();

    http.expectOne(URL_OF(SHA)).flush(answer({ patch: '', changesUnavailable: true }));
    harness.detectChanges();

    expect(text('.note.warn')).toBe(
      'GitHub would not give the changes to this file, so none are marked.',
    );
    expect(text('.count')).toBe('Changes not available');
    expect(codeLines().map((line) => line.kind)).toHaveLength(10);
  });

  it('says the changes do not fit the text, and marks none', async () => {
    const { harness, http, text, codeLines } = await open();

    http.expectOne(URL_OF(SHA)).flush(answer({ text: 'completely\ndifferent' }));
    harness.detectChanges();

    expect(text('.note.warn')).toBe(
      'These changes do not match this version of the file, so none are marked.',
    );
    expect(codeLines().map((line) => line.kind)).toEqual(['', '']);
  });

  it('says a renamed file was renamed, and opens the pull request it came from', async () => {
    const { harness, http, text, element } = await open();
    const renamed = [
      'diff --git a/src/old.ts b/src/a.ts',
      'rename from src/old.ts',
      'rename to src/a.ts',
      '@@ -1 +1 @@',
      '-x',
      '+one',
    ].join('\n');

    http.expectOne(URL_OF(SHA)).flush(answer({ text: 'one\n', patch: renamed }));
    harness.detectChanges();

    expect(text('.note')).toBe('Renamed from src/old.ts');
    const back = element.querySelector<HTMLAnchorElement>('.links a');
    expect(back?.getAttribute('href')).toBe('/p/me/app?pr=7');
  });

  it('keeps showing the commit it was opened at, and offers the latest when the pull request has moved on', async () => {
    const { harness, http, text, element, click } = await open();
    http.expectOne(URL_OF(SHA)).flush(answer({ headOid: HEAD }));
    harness.detectChanges();

    expect(text('.note.warn')).toContain('The pull request has newer commits than this one.');
    expect(element.querySelector('pre')).not.toBeNull();

    click(element.querySelector<HTMLElement>('.note.warn a')!);
    await harness.fixture.whenStable();

    http.expectOne(URL_OF(HEAD)).flush(answer({ sha: HEAD, headOid: HEAD }));
    harness.detectChanges();
    expect(element.querySelector('.note.warn')).toBeNull();
    expect(text('.stamp')).toContain(`commit ${HEAD.slice(0, 7)}`);
  });

  it('says a file over 1 MB is too large, with its size and a link to it on GitHub', async () => {
    const { harness, http, text, element } = await open();

    http
      .expectOne(URL_OF(SHA))
      .flush(answer({ state: 'too-large', text: '', patch: '', bytes: 2 * 1024 * 1024 }));
    harness.detectChanges();

    expect(text('.state strong')).toBe('This file is too large to show here (2048 KB).');
    expect(text('.state a')).toBe('Open it on GitHub. ↗');
    expect(element.querySelector('.state a')?.getAttribute('href')).toBe(
      `https://github.com/me/app/blob/${SHA}/src/a.ts`,
    );
    expect(element.querySelector('pre')).toBeNull();
  });

  it('says a file missing at that commit is not there, and links to the pull request on GitHub', async () => {
    const { harness, http, text, element } = await open();

    http.expectOne(URL_OF(SHA)).flush(
      answer({
        state: 'missing',
        text: '',
        patch: '',
        githubUrl: 'https://github.com/me/app/pull/7',
      }),
    );
    harness.detectChanges();

    expect(text('.state')).toContain('This file is not in the pull request at that commit.');
    expect(element.querySelector('.state a')?.getAttribute('href')).toBe(
      'https://github.com/me/app/pull/7',
    );
  });

  it('shows the private note, and no code, for a repository the preview withholds', async () => {
    const { harness, http, text, element } = await open();

    http.expectOne(URL_OF(SHA)).flush(answer({ state: 'hidden', text: '', patch: '', bytes: 0 }));
    harness.detectChanges();

    expect(text('.state')).toContain('This repository is private, so its code is not shown');
    expect(element.querySelector('pre')).toBeNull();
  });

  it('says so when the file cannot be read', async () => {
    const { harness, http, text } = await open();

    http.expectOne(URL_OF(SHA)).flush('no', { status: 502, statusText: 'Bad Gateway' });
    harness.detectChanges();

    expect(text('.state')).toContain('Could not read the file');
  });

  it('asks for nothing when the address does not name a file of a pull request', async () => {
    for (const address of [
      `/p/me/app/pull/7/file?path=src%2Fa.ts`,
      `/p/me/app/pull/7/file?sha=nothex&path=src%2Fa.ts`,
      `/p/me/app/pull/7/file?sha=${SHA.slice(0, 7)}&path=src%2Fa.ts`,
      `/p/me/app/pull/7/file?sha=${SHA}`,
      `/p/me/app/pull/0/file?sha=${SHA}&path=a.ts`,
      `/p/me/app/pull/x/file?sha=${SHA}&path=a.ts`,
    ]) {
      const { harness, http, text } = await open(address);
      harness.detectChanges();

      expect(text('.state'), address).toContain('does not name a file of a pull request');
      http.expectNone(() => true);
      TestBed.resetTestingModule();
    }
  });
});
