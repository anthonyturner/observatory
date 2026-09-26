import { TestBed } from '@angular/core/testing';
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
};

function render() {
  const fixture = TestBed.createComponent(StarCard);
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
});
