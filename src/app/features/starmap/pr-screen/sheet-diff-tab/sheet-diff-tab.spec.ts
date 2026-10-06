import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PullDetail } from '../../../../core/queue/pull-detail';
import { SheetDiffTab } from './sheet-diff-tab';
import { REWRITTEN_NOTE } from './diff-shown';

const LOOKED = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const fileDiff = (path: string): string =>
  `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-old\n+new`;

const detail = {
  number: 572,
  headOid: HEAD,
  diff: `${fileDiff('src/old.ts')}\n${fileDiff('src/new.ts')}`,
  diffBytes: 200,
  diffTruncated: false,
  diffHidden: false,
} as PullDetail;
const SINCE_URL = `/api/since-look?repo=me/app&base=${LOOKED}&head=${HEAD}`;

function render(lookedSha: string | null) {
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(SheetDiffTab);
  fixture.componentRef.setInput('repo', 'me/app');
  fixture.componentRef.setInput('detail', detail);
  fixture.componentRef.setInput('lookedSha', lookedSha);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const paths = () => Array.from(element.querySelectorAll('.dfile .p')).map((p) => p.textContent);
  const toggle = () => element.querySelector<HTMLInputElement>('.since input');
  return { fixture, element, paths, toggle, http: TestBed.inject(HttpTestingController) };
}

describe('SheetDiffTab', () => {
  it('shows the whole diff, with no toggle, for a pull request never looked at', () => {
    const { paths, toggle, http } = render(null);

    expect(toggle()).toBeNull();
    expect(paths()).toEqual(['src/old.ts', 'src/new.ts']);
    http.expectNone(() => true);
  });

  it('starts on just the changes since the last look, and toggles back to the whole diff', () => {
    const { fixture, element, paths, toggle, http } = render(LOOKED);
    expect(element.textContent).toContain('Reading the changes since your last look');

    http.expectOne(SINCE_URL).flush({
      base: LOOKED,
      head: HEAD,
      newCommits: 2,
      diff: fileDiff('src/new.ts'),
      diffBytes: 90,
    });
    fixture.detectChanges();

    expect(toggle()?.checked).toBe(true);
    expect(element.querySelector('.since')?.textContent).toContain('2 new commits');
    expect(paths()).toEqual(['src/new.ts']);

    toggle()!.click();
    fixture.detectChanges();
    expect(paths()).toEqual(['src/old.ts', 'src/new.ts']);
  });

  it('falls back to the whole diff with a note after a force-push', () => {
    const { fixture, element, paths, http } = render(LOOKED);

    http.expectOne(SINCE_URL).flush({ base: LOOKED, head: HEAD, newCommits: null, diff: '' });
    fixture.detectChanges();

    expect(element.querySelector('.note.warn')?.textContent).toBe(REWRITTEN_NOTE);
    expect(paths()).toEqual(['src/old.ts', 'src/new.ts']);
  });
});
