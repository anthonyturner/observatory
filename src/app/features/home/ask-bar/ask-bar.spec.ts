import { TestBed } from '@angular/core/testing';
import { AskBar } from './ask-bar';

function render() {
  const fixture = TestBed.createComponent(AskBar);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const box = element.querySelector('textarea') as HTMLTextAreaElement;
  const asked: string[] = [];
  fixture.componentInstance.asked.subscribe((text) => asked.push(text));
  return { fixture, element, box, asked };
}

const key = (init: KeyboardEventInit) =>
  new KeyboardEvent('keydown', { cancelable: true, ...init });

describe('AskBar', () => {
  it('has a labelled text box and Send', () => {
    const { element, box } = render();

    expect(element.querySelector(`label[for="${box.id}"]`)?.textContent).toContain('Ask Home');
    expect(element.querySelector('button[type="submit"]')?.textContent).toContain('Send');
  });

  it('sends the words on Send, without reloading the page, and empties the box', () => {
    const { element, box, asked } = render();
    box.value = '  open the orrery ';
    const submit = new Event('submit', { cancelable: true });

    element.querySelector('form')?.dispatchEvent(submit);

    expect(submit.defaultPrevented).toBe(true);
    expect(asked).toEqual(['open the orrery']);
    expect(box.value).toBe('');
  });

  it('sends on Enter, keeps Shift+Enter and a composing Enter for the box', () => {
    const { box, asked } = render();
    box.value = 'refresh';

    box.dispatchEvent(key({ key: 'Enter', shiftKey: true }));
    box.dispatchEvent(key({ key: 'Enter', isComposing: true }));
    expect(asked).toEqual([]);

    box.dispatchEvent(key({ key: 'Enter' }));
    expect(asked).toEqual(['refresh']);
  });

  it('sends nothing blank, and nothing while busy', () => {
    const { fixture, box, asked } = render();
    box.dispatchEvent(key({ key: 'Enter' }));

    fixture.componentRef.setInput('isBusy', true);
    fixture.detectChanges();
    box.value = 'help';
    box.dispatchEvent(key({ key: 'Enter' }));

    expect(asked).toEqual([]);
    expect(box.readOnly).toBe(true);
    expect(box.getAttribute('aria-busy')).toBe('true');
  });

  it('shows Keywords only while Jev is off', () => {
    const { fixture, element } = render();
    expect(element.querySelector('.kw-pill')).toBeNull();

    fixture.componentRef.setInput('isKeywordsOnly', true);
    fixture.detectChanges();

    expect(element.querySelector('.kw-pill')?.textContent).toBe('Keywords only');
  });

  it('takes the focus back when asked', () => {
    const { fixture, box } = render();

    fixture.componentRef.setInput('focusRequests', 1);
    fixture.detectChanges();

    expect(document.activeElement).toBe(box);
  });
});
