import { TestBed } from '@angular/core/testing';
import { CometCard } from './comet-card';

describe('CometCard', () => {
  it('names the comet and says how long it has waited, idle over a month hot', () => {
    const fixture = TestBed.createComponent(CometCard);
    fixture.componentRef.setInput('comet', {
      issue: 42,
      title: 'Fix the roster',
      url: 'https://github.com/me/a/issues/42',
      labels: ['bug', 'ui'],
      ageDays: 60,
      idleDays: 45,
    });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.bucketname')?.textContent).toBe(
      'Comet — no pull request closes it',
    );
    expect(element.querySelector('.prno')?.textContent).toBe('#42');
    expect(element.querySelector('dd.hot')?.textContent?.trim()).toBe('45 days');
    expect(element.querySelector('.facts')?.textContent).toContain('bug, ui');
    expect(element.querySelector('.cardacts a')?.getAttribute('href')).toBe(
      'https://github.com/me/a/issues/42',
    );
  });
});
