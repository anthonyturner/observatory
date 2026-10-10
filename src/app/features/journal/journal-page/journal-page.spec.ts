import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { JournalPage } from './journal-page';
import { journalStamp, stateMessage } from './journal-words';

const entry = (pull: number, postedAt: string, principles: string[]) => ({
  pull,
  url: `https://github.com/me/app/pull/${pull}#issuecomment-${pull}`,
  postedAt,
  firstVersion: `First version of ${pull}`,
  feedback: `Feedback on ${pull}`,
  change: `Change made for ${pull}`,
  principles,
});

const REPORT = {
  generatedAt: '2026-10-08T13:00:00Z',
  repo: 'me/app',
  entries: [
    entry(9, '2026-10-08T12:00:00Z', ['deep-modules', 'design-it-twice']),
    entry(7, '2026-10-05T12:00:00Z', ['design-it-twice']),
  ],
};

const PRINCIPLES = {
  today: 0,
  principles: [
    { id: 'deep-modules', title: 'Make modules deep', idea: 'Hide a lot.', question: 'Which?' },
    { id: 'design-it-twice', title: 'Design it twice', idea: 'Sketch two.', question: 'Second?' },
  ],
};

function render() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ owner: 'me', repo: 'app' })) },
      },
    ],
  });
  const fixture = TestBed.createComponent(JournalPage);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http, element: fixture.nativeElement as HTMLElement };
}

const texts = (element: HTMLElement, selector: string): (string | undefined)[] =>
  [...element.querySelectorAll(selector)].map((each) => each.textContent?.trim());

describe('JournalPage', () => {
  it('lists the lessons newest first, each linked to its pull request, with principle chips', () => {
    const { fixture, http, element } = render();
    http.expectOne('/api/journal?repo=me/app').flush(REPORT);
    http.expectOne((request) => request.url === '/api/principles').flush(PRINCIPLES);
    fixture.detectChanges();

    expect(element.querySelector('h1')?.textContent).toBe('Journal');
    const links = [...element.querySelectorAll('app-journal-entry header a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://github.com/me/app/pull/9#issuecomment-9',
      'https://github.com/me/app/pull/7#issuecomment-7',
    ]);
    expect(element.querySelector('app-journal-entry dd')?.textContent).toBe('First version of 9');
    expect(texts(element, '.chips .chip')).toEqual(['Design it twice 2', 'Make modules deep 1']);
    expect(element.querySelector('.state')).toBeNull();
  });

  it('narrows to the lessons a principle taught when its chip is pressed, and widens again', () => {
    const { fixture, http, element } = render();
    http.expectOne('/api/journal?repo=me/app').flush(REPORT);
    http.expectOne((request) => request.url === '/api/principles').flush(PRINCIPLES);
    fixture.detectChanges();
    const deepChip = [...element.querySelectorAll<HTMLButtonElement>('.chips .chip')][1];

    deepChip.click();
    fixture.detectChanges();

    expect(deepChip.getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelectorAll('app-journal-entry').length).toBe(1);
    expect(element.querySelector('.picked')?.textContent).toContain('1 of 2 taught');
    expect(element.querySelector('.picked')?.textContent).toContain('Hide a lot.');

    deepChip.click();
    fixture.detectChanges();

    expect(element.querySelectorAll('app-journal-entry').length).toBe(2);
    expect(element.querySelector('.picked')?.textContent?.trim()).toBe('');
  });

  it('labels chips by their ids while the principles cannot be read', () => {
    const { fixture, http, element } = render();
    http.expectOne('/api/journal?repo=me/app').flush(REPORT);
    http
      .expectOne((request) => request.url === '/api/principles')
      .flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texts(element, '.chips .chip')).toEqual(['design-it-twice 2', 'deep-modules 1']);
  });

  it('says so, and shows no list, while no review has recorded a lesson', () => {
    const { fixture, http, element } = render();
    http.expectOne('/api/journal?repo=me/app').flush({ ...REPORT, entries: [] });
    http.expectOne((request) => request.url === '/api/principles').flush(PRINCIPLES);
    fixture.detectChanges();

    expect(element.querySelector('.state')?.textContent).toContain('No lessons recorded yet');
    expect(element.querySelector('app-journal-entry')).toBeNull();
    expect(element.querySelector('.chips')).toBeNull();
  });
});

describe('journal words', () => {
  it('says what the journal is doing until it has lessons to show', () => {
    expect(stateMessage({ status: 'reading' })?.headline).toBe('Opening the journal…');
    expect(stateMessage({ status: 'missing' })?.headline).toBe('No such project');
    expect(stateMessage({ status: 'unreachable' })?.headline).toBe('Could not read the journal');
  });

  it('stamps the repository with how many lessons it holds', () => {
    expect(journalStamp('me/app', null)).toBe('me/app');
    expect(journalStamp('me/app', { generatedAt: 0, repo: 'me/app', entries: [] })).toBe(
      'me/app · 0 lessons',
    );
  });
});
