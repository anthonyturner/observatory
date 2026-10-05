import { TestBed } from '@angular/core/testing';
import { StarmapSearch } from './starmap-search';

function render(miss: string | null = null) {
  const fixture = TestBed.createComponent(StarmapSearch);
  fixture.componentRef.setInput('suggestions', ['#3 A pull']);
  fixture.componentRef.setInput('miss', miss);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const searched: string[] = [];
  fixture.componentInstance.find.subscribe((query) => searched.push(query));
  return { element, searched };
}

describe('StarmapSearch', () => {
  it('searches what was typed when the form is sent', () => {
    const { element, searched } = render();
    const box = element.querySelector('input') as HTMLInputElement;
    box.value = '#3';
    element.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(searched).toEqual(['#3']);
  });

  it('sends nothing for a blank box', () => {
    const { element, searched } = render();
    element.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(searched).toEqual([]);
  });

  it('offers suggestions, and says when nothing matched', () => {
    const { element } = render('Nothing matches “nebula”.');

    expect(element.querySelector('option')?.getAttribute('value')).toBe('#3 A pull');
    expect(element.querySelector('.miss')?.textContent).toContain('nebula');
  });
});
