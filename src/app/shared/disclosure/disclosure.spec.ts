import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { ELEMENT_SIZE, ElementSize } from '../element-size/element-size';
import { Disclosure } from './disclosure';

@Component({
  imports: [Disclosure],
  template: `
    <div [appDisclosure]="button" #menu="appDisclosure">
      <button
        #button
        type="button"
        [attr.aria-expanded]="menu.isOpen()"
        [attr.aria-controls]="menu.panelId"
        (click)="menu.toggle()"
      >
        Menu
      </button>
      <div [id]="menu.panelId"><a href="#one" (click)="menu.closeToTrigger()">One</a></div>
    </div>
  `,
})
class Host {}

describe('Disclosure', () => {
  let sizes: Subject<ElementSize>;
  const mount = () => {
    sizes = new Subject<ElementSize>();
    TestBed.configureTestingModule({
      providers: [{ provide: ELEMENT_SIZE, useValue: () => sizes }],
    });
    const fixture = TestBed.createComponent(Host);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host,
      button: host.querySelector('button') as HTMLButtonElement,
      link: host.querySelector('a') as HTMLAnchorElement,
      disclosure: fixture.debugElement.query(By.directive(Disclosure)).injector.get(Disclosure),
    };
  };
  const escape = () => new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });

  afterEach(() => document.body.replaceChildren());

  it('starts closed and opens and closes with its button, which it ties to the list by id', () => {
    const { fixture, host, button, disclosure } = mount();

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe(disclosure.panelId);
    expect(host.querySelector('#' + disclosure.panelId)?.querySelector('a')).not.toBeNull();

    button.click();
    fixture.detectChanges();
    expect(disclosure.isOpen()).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');

    button.click();
    fixture.detectChanges();
    expect(disclosure.isOpen()).toBe(false);
  });

  it('gives each disclosure an id of its own', () => {
    const { disclosure } = mount();
    const other = TestBed.createComponent(Host);
    other.detectChanges();
    const second = other.debugElement.query(By.directive(Disclosure)).injector.get(Disclosure);

    expect(second.panelId).not.toBe(disclosure.panelId);
  });

  it('closes on Escape, keeps the key from the page and puts focus back on the button', () => {
    const { fixture, button, link } = mount();
    const page = vi.fn();
    document.addEventListener('keydown', page);
    button.click();
    fixture.detectChanges();
    link.focus();

    link.dispatchEvent(escape());
    fixture.detectChanges();
    document.removeEventListener('keydown', page);

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
    expect(page).not.toHaveBeenCalled();
  });

  it('takes focus when it opens, so Escape works after a click that focuses nothing', () => {
    const { fixture, button } = mount();
    const page = vi.fn();
    document.addEventListener('keydown', page);
    button.click();
    fixture.detectChanges();

    expect(document.activeElement).toBe(button);
    button.dispatchEvent(escape());
    fixture.detectChanges();
    document.removeEventListener('keydown', page);

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(page).not.toHaveBeenCalled();
  });

  it('leaves Escape to the page while it is closed', () => {
    const { button } = mount();
    const page = vi.fn();
    document.addEventListener('keydown', page);

    button.dispatchEvent(escape());
    document.removeEventListener('keydown', page);

    expect(page).toHaveBeenCalledOnce();
  });

  it('closes to the button when a choice is made, and closes in place on request', () => {
    const { fixture, button, link, disclosure } = mount();
    button.click();
    fixture.detectChanges();

    link.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);

    button.click();
    link.focus();
    disclosure.close();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(link);
  });

  it('closes on a press outside, and stays open on a press inside', () => {
    const { fixture, link, button } = mount();
    button.click();
    fixture.detectChanges();

    link.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');

    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes when focus moves out of it', () => {
    const { fixture, host, button } = mount();
    const elsewhere = document.body.appendChild(document.createElement('button'));
    button.click();
    fixture.detectChanges();

    host.firstElementChild?.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: elsewhere }),
    );
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('stays open when focus goes nowhere, as on a press on text inside it', () => {
    const { fixture, host, button } = mount();
    button.click();
    fixture.detectChanges();

    host.firstElementChild?.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: null }),
    );
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes when the button is taken away by a resize, and not while it keeps its size', () => {
    const { fixture, button } = mount();
    button.click();
    fixture.detectChanges();

    sizes.next({ width: 117, height: 24 });
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');

    sizes.next({ width: 0, height: 0 });
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});
