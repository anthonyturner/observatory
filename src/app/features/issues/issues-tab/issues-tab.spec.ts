import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { IssuesTab } from './issues-tab';

const report = {
  generatedAt: new Date().toISOString(),
  repo: 'me/a',
  items: [
    {
      number: 1,
      title: 'Crash on start',
      url: 'https://github.com/me/a/issues/1',
      labels: ['bug'],
      assignees: [],
      pulls: [],
      idleDays: 4,
    },
    {
      number: 2,
      title: 'Add dark mode',
      url: 'https://github.com/me/a/issues/2',
      labels: [],
      assignees: ['kim'],
      pulls: [50],
      idleDays: 1,
    },
  ],
  closedRecently: 3,
  closedWindowDays: 30,
};

function render() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(IssuesTab);
  fixture.componentRef.setInput('repo', 'me/a');
  fixture.detectChanges();
  TestBed.inject(HttpTestingController).expectOne('/api/issues?repo=me/a').flush(report);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('IssuesTab', () => {
  it('lists nobody-on-it first, then in progress with its pull request', () => {
    const { element } = render();

    expect(Array.from(element.querySelectorAll('h2')).map((h) => h.textContent?.trim())).toEqual([
      'Nobody on itno open pull request closes it · 1',
      'In progressan open pull request says it closes it · 1',
    ]);
    expect(element.querySelector('.detail a')?.getAttribute('href')).toBe(
      'https://github.com/me/a/pull/50',
    );
    expect(element.querySelector('.stamp')?.textContent).toContain(
      '2 open · 1 nobody on · 3 closed in 30 days',
    );
  });

  it('narrows the list as you type', () => {
    const { fixture, element } = render();
    const input = element.querySelector('input') as HTMLInputElement;

    input.value = 'dark';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(element.querySelectorAll('li').length).toBe(1);
    expect(element.querySelector('li .title')?.textContent).toContain('Add dark mode');
  });
});
