import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEWS_STATE } from '../../../core/news/news-feed';
import { NewsItem, NewsState } from '../../../core/news/news.types';
import { Reader } from '../../../core/reader/reader-service';
import { ViewerSession } from '../../../core/session/viewer-session';
import { Clock } from '../../../core/time/clock';
import { NewsSection } from './news-section';

const NOW = new Date('2026-09-28T12:00:00Z');
const item = (title: string, tool = false): NewsItem => ({
  title,
  url: `https://news.example/${encodeURIComponent(title)}`,
  source: 'Blog',
  publishedAt: '2026-09-28T09:00:00Z',
  summary: tool ? ['Claude Code 3 writes and runs its own tests.'] : [],
  tool,
});
const ready = (unread: string[] = []): NewsState => ({
  status: 'ready',
  report: {
    ai: [item('Claude Code 3 ships', true), item('Thoughts on AI')],
    engineering: [item('Monorepos at scale')],
    unread,
    readAt: NOW.toISOString(),
  },
});

function render(state: NewsState, access: 'local' | 'visitor' = 'local') {
  const reader = { open: vi.fn(async () => undefined) };
  TestBed.configureTestingModule({
    providers: [
      { provide: NEWS_STATE, useValue: signal(state) },
      { provide: Reader, useValue: reader },
      { provide: ViewerSession, useValue: { access: signal(access) } },
      { provide: Clock, useValue: { now: signal(NOW) } },
    ],
  });
  const fixture = TestBed.createComponent(NewsSection);
  fixture.detectChanges();
  return { element: fixture.nativeElement as HTMLElement, reader };
}

const texts = (element: HTMLElement, selector: string): string[] =>
  Array.from(element.querySelectorAll(selector)).map((each) => each.textContent?.trim() ?? '');

describe('NewsSection', () => {
  it('lists AI news with tools marked, then software engineering, with source and age', () => {
    const { element } = render(ready());

    expect(texts(element, 'h3')).toEqual(['AI news tools first', 'Software engineering latest']);
    expect(texts(element, '.title')).toEqual([
      'Claude Code 3 ships',
      'Thoughts on AI',
      'Monorepos at scale',
    ]);
    expect(texts(element, '.tool')).toEqual(['tool']);
    expect(texts(element, '.summary')).toEqual(['Claude Code 3 writes and runs its own tests.']);
    expect(texts(element, '.meta')[1]).toBe('Blog · 3h');
  });

  it('names the feeds it could not read', () => {
    expect(texts(render(ready(['InfoQ'])).element, '.note')).toEqual([
      'Not read this time: InfoQ.',
    ]);
  });

  it('says it is reading, or out of reach, in place of headlines', () => {
    expect(texts(render({ status: 'reading' }).element, '.empty')[0]).toContain('Reading');
    TestBed.resetTestingModule();
    expect(texts(render({ status: 'unreachable' }).element, '.empty')[0]).toContain('out of reach');
  });

  it('reads a story in the floating reader on this machine, but lets a hosted click open a tab', () => {
    const local = render(ready());
    const link = local.element.querySelector<HTMLAnchorElement>('.title')!;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(click);
    expect(local.reader.open).toHaveBeenCalledWith(link.href);
    expect(click.defaultPrevented).toBe(true);

    TestBed.resetTestingModule();
    const hosted = render(ready(), 'visitor');
    const away = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    hosted.element.querySelector('.title')!.dispatchEvent(away);
    expect(hosted.reader.open).not.toHaveBeenCalled();
    expect(away.defaultPrevented).toBe(false);
  });
});
