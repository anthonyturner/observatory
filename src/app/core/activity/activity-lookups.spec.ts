import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ACTIVITY_LOOKUPS, LOOKUP_TIMEOUT_MS, Lookup } from './activity-lookups';

function setUp() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  return { lookups: TestBed.inject(ACTIVITY_LOOKUPS), http: TestBed.inject(HttpTestingController) };
}

const ISSUE = {
  number: 7,
  title: 'Crash on load',
  url: 'https://github.com/me/alpha/issues/7',
  createdAt: '2026-10-03T12:00:00Z',
  updatedAt: '2026-10-03T12:00:00Z',
  body: '',
};

describe('ACTIVITY_LOOKUPS', () => {
  it('reads whether a pull request merged, and its title', () => {
    const { lookups, http } = setUp();
    const seen: Lookup<unknown>[] = [];

    lookups.pullState('me/alpha', 10).subscribe((lookup) => seen.push(lookup));
    http
      .expectOne('/api/pull-state?repo=me/alpha&number=10')
      .flush({ state: 'MERGED', title: 'Fold the bar' });

    expect(seen).toEqual([{ status: 'found', value: { state: 'MERGED', title: 'Fold the bar' } }]);
  });

  it('reads an issue’s title, and that it is open', () => {
    const { lookups, http } = setUp();
    const seen: Lookup<unknown>[] = [];

    lookups.issue('me/alpha', 7).subscribe((lookup) => seen.push(lookup));
    http.expectOne('/api/issue?repo=me/alpha&number=7').flush(ISSUE);

    expect(seen).toEqual([{ status: 'found', value: { title: 'Crash on load', closedAt: null } }]);
  });

  it('reads when an issue closed', () => {
    const { lookups, http } = setUp();
    const seen: Lookup<unknown>[] = [];

    lookups.issue('me/alpha', 7).subscribe((lookup) => seen.push(lookup));
    http
      .expectOne('/api/issue?repo=me/alpha&number=7')
      .flush({ ...ISSUE, closedAt: '2026-10-03T12:30:00Z', stateReason: 'COMPLETED' });

    expect(seen).toEqual([
      { status: 'found', value: { title: 'Crash on load', closedAt: '2026-10-03T12:30:00Z' } },
    ]);
  });

  it('tells a refusal apart from any other failure', () => {
    const { lookups, http } = setUp();
    const seen: Lookup<unknown>[] = [];

    lookups.pullState('me/alpha', 1).subscribe((lookup) => seen.push(lookup));
    lookups.pullState('me/alpha', 2).subscribe((lookup) => seen.push(lookup));
    lookups.pullState('me/alpha', 3).subscribe((lookup) => seen.push(lookup));
    lookups.pullState('me/alpha', 4).subscribe((lookup) => seen.push(lookup));
    http
      .expectOne('/api/pull-state?repo=me/alpha&number=1')
      .flush('sign in', { status: 401, statusText: 'Unauthorized' });
    http
      .expectOne('/api/pull-state?repo=me/alpha&number=2')
      .flush('preview', { status: 403, statusText: 'Forbidden' });
    http
      .expectOne('/api/pull-state?repo=me/alpha&number=3')
      .flush('down', { status: 502, statusText: 'Bad Gateway' });
    http.expectOne('/api/pull-state?repo=me/alpha&number=4').flush({ state: 'GONE', title: 'x' });

    expect(seen.map((lookup) => lookup.status)).toEqual(['denied', 'denied', 'failed', 'failed']);
  });

  it('gives up on a lookup that never answers, so later checks are not held', () => {
    vi.useFakeTimers();
    try {
      const { lookups, http } = setUp();
      const seen: Lookup<unknown>[] = [];
      lookups.pullState('me/alpha', 10).subscribe((lookup) => seen.push(lookup));
      lookups.issue('me/alpha', 7).subscribe((lookup) => seen.push(lookup));
      const pending = [
        http.expectOne('/api/pull-state?repo=me/alpha&number=10'),
        http.expectOne('/api/issue?repo=me/alpha&number=7'),
      ];

      vi.advanceTimersByTime(LOOKUP_TIMEOUT_MS - 1);
      expect(seen).toEqual([]);
      vi.advanceTimersByTime(1);

      expect(seen).toEqual([{ status: 'failed' }, { status: 'failed' }]);
      expect(pending.every((request) => request.cancelled)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
