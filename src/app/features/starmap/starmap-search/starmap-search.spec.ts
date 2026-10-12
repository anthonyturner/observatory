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

  it('searches what was typed when the find button is pressed', () => {
    const { element, searched, typeIn } = render();
    const button = element.querySelector<HTMLButtonElement>('button[type="submit"]');
    typeIn('#3');

    button?.click();

    expect(button?.getAttribute('aria-label')).toBe('Find');
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

  it('sets finished work’s tag apart, and searches the whole suggestion', () => {
    const { fixture, element, searched, typeIn, options } = render();
    fixture.componentRef.setInput('suggestions', ['#5 Shipped · merged']);
    typeIn('ship');

    expect(element.querySelector('[role="option"] .tag')?.textContent).toBe('merged');
    (options()[0] as HTMLElement).click();
    expect(searched).toEqual(['#5 Shipped · merged']);
  });

  it('closes when the pointer leaves, the box loses focus, or on Escape', () => {
    const { fixture, element, box, list, key } = render();
    const reopen = () => {
      box.click();
      fixture.detectChanges();
    };

    reopen();
    element.querySelector('form')?.dispatchEvent(new MouseEvent('mouseleave'));
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

  it('tells the page while its suggestions or a miss show under the box', () => {
    const { fixture, box, key } = render();
    const reaches: boolean[] = [];
    fixture.componentInstance.reachesBelow.subscribe((value) => reaches.push(value));

    box.click();
    fixture.detectChanges();
    key('Escape');
    fixture.componentRef.setInput('miss', 'Nothing matches “nebula”.');
    fixture.detectChanges();

    expect(reaches).toEqual([false, true, false, true]);
  });

  it('drops a miss once new words are typed, and shows it again for the words that missed', () => {
    const { fixture, element, typeIn } = render();
    typeIn('nebula');
    element.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.componentRef.setInput('miss', 'Nothing matches “nebula”.');
    fixture.detectChanges();
    expect(element.querySelector('.miss')).not.toBeNull();

    typeIn('nebul');
    expect(element.querySelector('.miss')).toBeNull();

    typeIn('nebula');
    expect(element.querySelector('.miss')).not.toBeNull();
  });
});
