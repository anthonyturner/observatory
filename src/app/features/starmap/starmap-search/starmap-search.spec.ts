import { TestBed } from '@angular/core/testing';
import { StarmapSearch } from './starmap-search';

function render(miss: string | null = null) {
  const fixture = TestBed.createComponent(StarmapSearch);
  fixture.componentRef.setInput('suggestions', ['#3 A pull', '#4 An issue']);
  fixture.componentRef.setInput('miss', miss);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const box = element.querySelector('input') as HTMLInputElement;
  const list = element.querySelector('[role="listbox"]') as HTMLElement;
  const searched: string[] = [];
  fixture.componentInstance.find.subscribe((query) => searched.push(query));
  const typeIn = (value: string) => {
    box.value = value;
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const key = (name: string) => {
    box.dispatchEvent(new KeyboardEvent('keydown', { key: name, cancelable: true }));
    fixture.detectChanges();
  };
  const options = () => [...element.querySelectorAll('[role="option"]')];
  return { fixture, element, box, list, searched, typeIn, key, options };
}

describe('StarmapSearch', () => {
  it('searches what was typed when the form is sent', () => {
    const { element, searched, typeIn } = render();
    typeIn('#3');
    element.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(searched).toEqual(['#3']);
  });

  it('sends nothing for a blank box', () => {
    const { element, searched } = render();
    element.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(searched).toEqual([]);
  });

  it('keeps its suggestions shut until the box is clicked', () => {
    const { fixture, box, list } = render();
    expect(list.hidden).toBe(true);

    box.click();
    fixture.detectChanges();

    expect(list.hidden).toBe(false);
    expect(box.getAttribute('aria-expanded')).toBe('true');
  });

  it('narrows them as you type, and searches the one picked', () => {
    const { searched, typeIn, options } = render();
    typeIn('issue');

    expect(options().map((o) => o.textContent?.trim())).toEqual(['#4 An issue']);
    (options()[0] as HTMLElement).click();
    expect(searched).toEqual(['#4 An issue']);
  });

  it('closes when the pointer leaves, the box loses focus, or on Escape', () => {
    const { fixture, element, box, list, key } = render();
    const reopen = () => {
      box.click();
      fixture.detectChanges();
    };

    reopen();
    element.dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();
    expect(list.hidden).toBe(true);

    reopen();
    box.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(list.hidden).toBe(true);

    reopen();
    key('Escape');
    expect(list.hidden).toBe(true);
  });

  it('walks the list with the arrow keys and picks with Enter', () => {
    const { box, searched, key } = render();
    box.click();
    key('ArrowDown');
    key('ArrowDown');

    expect(box.getAttribute('aria-activedescendant')).toBe('starmap-search-option-1');
    key('Enter');
    expect(searched).toEqual(['#4 An issue']);
  });

  it('says when nothing matched', () => {
    const { element } = render('Nothing matches “nebula”.');

    expect(element.querySelector('.miss')?.textContent).toContain('nebula');
  });
});
