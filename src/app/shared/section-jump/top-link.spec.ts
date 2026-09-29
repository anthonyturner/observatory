import { TestBed } from '@angular/core/testing';
import { TopLink } from './top-link';

describe('TopLink', () => {
  it('returns to the first screen, moving focus there without changing the address', () => {
    const fixture = TestBed.createComponent(TopLink);
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('href')).toBe('#top');

    const top = document.createElement('div');
    top.id = 'top';
    top.tabIndex = -1;
    top.scrollIntoView = vi.fn();
    document.body.append(top);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link?.dispatchEvent(click);

    expect(top.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(top);
    expect(click.defaultPrevented).toBe(true);
    top.remove();
  });

  it('leaves a Ctrl-click to the browser', () => {
    const fixture = TestBed.createComponent(TopLink);
    fixture.detectChanges();
    const top = document.createElement('div');
    top.id = 'top';
    top.scrollIntoView = vi.fn();
    document.body.append(top);
    const click = new MouseEvent('click', { cancelable: true, button: 0, ctrlKey: true });
    (fixture.nativeElement as HTMLElement).querySelector('a')?.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
    expect(top.scrollIntoView).not.toHaveBeenCalled();
    top.remove();
  });
});
