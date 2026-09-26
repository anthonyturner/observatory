import { TestBed } from '@angular/core/testing';
import { NewsState } from '../memory-view';
import { ChangesPanel, tallies } from './changes-panel';

const news: NewsState = {
  events: [
    { kind: 'blocked', pr: 598, title: 'choose widgets', bucket: 'conflicted' },
    { kind: 'merged', pr: 599, title: 'close widgets', bucket: 'unreviewed' },
  ],
  label: 'since the previous refresh',
  since: '2026-09-26T08:16:00Z',
  acknowledged: false,
};

function render(replayAt: string | null = null) {
  const fixture = TestBed.createComponent(ChangesPanel);
  fixture.componentRef.setInput('news', news);
  fixture.componentRef.setInput('replayAt', replayAt);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('ChangesPanel', () => {
  it('titles the news, spans it to now, and tallies each kind', () => {
    const { element } = render();

    expect(element.querySelector('h2')?.textContent).toBe('Since the previous refresh');
    expect(element.querySelector('.since')?.textContent).toContain('→ now');
    expect(
      Array.from(element.querySelectorAll('.tally')).map((t) => t.textContent?.trim()),
    ).toEqual(['1 newly blocked', '1 merged']);
  });

  it('flies to a star still in the sky, but not to one that left', () => {
    const { fixture, element } = render();
    const went: number[] = [];
    fixture.componentInstance.go.subscribe((pr) => went.push(pr));
    const [blocked, merged] = Array.from(element.querySelectorAll<HTMLElement>('li'));

    blocked.click();
    merged.click();

    expect(went).toEqual([598]);
  });

  it('offers Hide in place of Got it while replaying', () => {
    const { element } = render('2026-09-25T10:00:00Z');
    expect(element.querySelectorAll('button')[1].textContent?.trim()).toBe('Hide');
  });

  it('tallies in the order the kinds arrive', () => {
    expect(tallies(news.events)).toEqual([
      { kind: 'blocked', count: 1 },
      { kind: 'merged', count: 1 },
    ]);
  });
});
