import { TestBed } from '@angular/core/testing';
import { LogStar, layoutLogs } from '../../../core/logs/log-layout';
import { LOG_FIXTURE, TEST_PALETTE } from '../../../core/logs/testing/log-fixture';
import { LogList } from './log-list';

const layout = layoutLogs(LOG_FIXTURE, TEST_PALETTE);

function render(filter: 'warn' | null = null) {
  const fixture = TestBed.createComponent(LogList);
  fixture.componentRef.setInput('layout', layout);
  fixture.componentRef.setInput('filter', filter);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('LogList', () => {
  it('lists every fault under its window', () => {
    const { element } = render();

    expect(
      Array.from(element.querySelectorAll('h3')).map((h) => h.firstChild?.textContent?.trim()),
    ).toEqual(['desktop', 'ally ult tracker', 'hero lookup']);
    expect(element.querySelectorAll('li').length).toBe(5);
    expect(element.querySelector('li .n')?.textContent).toBe('×4');
  });

  it('narrows to the filtered level', () => {
    expect(render('warn').element.querySelectorAll('li').length).toBe(2);
  });

  it('picks a row’s star by click and by Enter', () => {
    const { fixture, element } = render();
    const picked: LogStar[] = [];
    fixture.componentInstance.picked.subscribe((star) => picked.push(star));
    const [first, second] = Array.from(element.querySelectorAll('li'));

    first.click();
    second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(picked).toEqual([layout.stars[0], layout.stars[1]]);
  });
});
