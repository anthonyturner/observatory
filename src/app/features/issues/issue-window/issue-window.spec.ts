import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { anIssue } from '../../../core/issues/testing/issues-fixture';
import { IssueWindow } from './issue-window';

const URL = '/api/issue?repo=me/a&number=12';

function render() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(IssueWindow);
  fixture.componentRef.setInput('repo', 'me/a');
  fixture.componentRef.setInput('number', 12);
  fixture.componentRef.setInput(
    'seed',
    anIssue(12, { title: 'Fix the lobby', labels: [{ name: 'bug', color: 'd73a4a' }] }),
  );
  fixture.componentRef.setInput('pulls', new Map());
  fixture.componentRef.setInput('now', Date.parse('2026-09-26T12:00:00Z'));
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const http = TestBed.inject(HttpTestingController);
  const button = (words: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === words);
  return { fixture, element, http, button };
}

const detail = (body: string, fetchedAt: string) => ({
  ...anIssue(12, { title: 'Fix the lobby, fully' }),
  body,
  bodyTruncated: false,
  fetchedAt,
});

describe('IssueWindow', () => {
  it('draws the header from the list at once, then the description', () => {
    const { fixture, element, http } = render();

    expect(element.querySelector('h2')?.textContent).toContain('#12Fix the lobby');
    expect(element.querySelector('.kicker')?.textContent).toBe('Comet — no pull request closes it');
    expect(element.querySelector('.ibody')?.textContent).toContain('Loading the description…');
    expect(element.textContent).toContain('nobody assigned');

    http.expectOne(URL).flush(detail('Steps to **reproduce**', '2026-09-26T12:00:00Z'));
    fixture.detectChanges();

    expect(element.querySelector('h2')?.textContent).toContain('Fix the lobby, fully');
    expect(element.querySelector('.ibody')?.textContent).toContain('Steps to reproduce');
  });

  it('offers to try again when GitHub does not return it', () => {
    const { fixture, element, http, button } = render();
    http.expectOne(URL).flush({ error: 'gone' }, { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();

    expect(element.querySelector('.ibody')?.textContent).toContain(
      'GitHub didn’t return this issue',
    );
    button('Try again')?.click();
    http.expectOne(`${URL}&fresh=1`);
  });

  it('fetches it anew on Refresh and says it was updated', () => {
    const { fixture, element, http, button } = render();
    http.expectOne(URL).flush(detail('One', '2026-09-26T12:00:00Z'));
    fixture.detectChanges();

    button('Refresh')?.click();
    fixture.detectChanges();
    expect(button('Fetching…')?.disabled).toBe(true);
    http.expectOne(`${URL}&fresh=1`).flush(detail('Two', '2026-09-26T12:05:00Z'));
    fixture.detectChanges();

    expect(element.querySelector('.istatus')?.textContent).toBe('Updated');
    expect(element.querySelector('.ibody')?.textContent).toContain('Two');
  });
});
