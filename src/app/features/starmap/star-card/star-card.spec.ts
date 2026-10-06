import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CrewDispatch } from '../../../core/crew/crew-dispatch';
import { QueueItem } from '../../../core/queue/queue-report';
import { StarCard } from './star-card';

const item: QueueItem = {
  number: 58,
  title: 'Replace the facade',
  url: 'https://github.com/me/a/pull/58',
  isDraft: false,
  bucket: 'conflicted',
  closes: [57],
  failingChecks: 0,
  additions: 96,
  deletions: 95,
  idleDays: 49,
  ageDays: 58,
  branch: 'refactor/57',
  base: 'main',
  mergeable: 'CONFLICTING',
  changedFiles: 4,
  isSeen: false,
  hidden: null,
  lookedSha: null,
  sinceLook: null,
};

function render(hasRunner = false) {
  const dispatch = {
    isAvailable: signal(hasRunner),
    crews: signal([]),
    isRunnerBusy: signal(false),
    isSending: () => false,
    refusalFor: () => null,
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: CrewDispatch, useValue: dispatch },
    ],
  });
  const fixture = TestBed.createComponent(StarCard);
  fixture.componentRef.setInput('repo', 'me/a');
  fixture.componentRef.setInput('item', item);
  fixture.componentRef.setInput('context', { pairs: [], binaries: [] });
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = (words: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === words,
    );
  return { fixture, element, button };
}

describe('StarCard', () => {
  beforeEach(() => localStorage.clear());

  it('names the bucket and number, then the title and facts', () => {
    const { element } = render();

    expect(element.querySelector('.bucketname')?.textContent).toBe('Aporia — cannot merge');
    expect(element.querySelector('.prno')?.textContent).toBe('#58');
    expect(element.querySelector('h2')?.textContent).toBe('Replace the facade');
    expect(element.querySelector('.facts')?.textContent).toContain('ready · conflicting');
  });

  it('says how many commits are new since it was last looked at', () => {
    const { fixture, element } = render();
    expect(element.querySelector('.since')).toBeNull();

    fixture.componentRef.setInput('item', { ...item, sinceLook: { newCommits: 3 } });
    fixture.detectChanges();
    expect(element.querySelector('.since')?.textContent).toBe('3 new commits since you looked');

    fixture.componentRef.setInput('item', { ...item, sinceLook: { newCommits: null } });
    fixture.detectChanges();
    expect(element.querySelector('.since')?.textContent).toBe('Changed since you looked');
  });

  it('tags its risk from the files it changes, with a one-line summary', () => {
    const { fixture, element } = render();
    const http = TestBed.inject(HttpTestingController);
    const head = 'c'.repeat(40);

    http
      .expectOne('/api/risk?repo=me/a&number=58')
      .flush({ number: 58, headSha: head, level: 'high', reasons: ['auth'], summarizes: true });
    http
      .expectOne('/api/risk/summary?repo=me/a&number=58')
      .flush({ number: 58, headSha: head, summary: 'Moves sign-in behind one service.' });
    fixture.detectChanges();

    expect(element.querySelector('.risk')?.getAttribute('data-level')).toBe('high');
    expect(element.querySelector('.risk .tag')?.textContent).toBe('High risk');
    expect(element.querySelector('.risk .why')?.textContent).toBe('auth');
    expect(element.querySelector('.gist')?.textContent).toBe('Moves sign-in behind one service.');
  });

  it('links to GitHub and the issue it closes', () => {
    const hrefs = Array.from(render().element.querySelectorAll('.cardacts a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toEqual(['https://github.com/me/a/pull/58', 'https://github.com/me/a/issues/57']);
  });

  it('offers a visitor no way to change anything', () => {
    const { fixture, button } = render();
    fixture.componentRef.setInput('canWrite', false);
    fixture.detectChanges();

    expect(button('Snooze 7d')).toBeUndefined();
    expect(button('Dismiss')).toBeUndefined();
    expect(button('Open')).toBeDefined();
  });

  it('asks to open, snooze, dismiss or close', () => {
    const { fixture, button, element } = render();
    const asked: string[] = [];
    fixture.componentInstance.open.subscribe((n) => asked.push(`open ${n}`));
    fixture.componentInstance.snooze.subscribe((n) => asked.push(`snooze ${n}`));
    fixture.componentInstance.dismiss.subscribe((n) => asked.push(`dismiss ${n}`));
    fixture.componentInstance.closed.subscribe(() => asked.push('closed'));

    button('Open')?.click();
    button('Snooze 7d')?.click();
    button('Dismiss')?.click();
    element.querySelector<HTMLButtonElement>('.close')?.click();

    expect(asked).toEqual(['open 58', 'snooze 58', 'dismiss 58', 'closed']);
  });

  it('offers Send crew on a conflicted pull request where a crew can be sent, and not in a replay', () => {
    const { fixture, button } = render(true);

    expect(button('Send crew')).toBeDefined();
    fixture.componentRef.setInput('context', {
      pairs: [],
      binaries: [],
      replay: { at: '2026-10-01T00:00:00Z', now: 'still open', live: true },
    });
    fixture.detectChanges();

    expect(button('Send crew')).toBeUndefined();
  });

  it('offers no crew where none can be sent', () => {
    expect(render().button('Send crew')).toBeUndefined();
  });
});
