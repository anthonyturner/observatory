import { TestBed } from '@angular/core/testing';
import { AskBar } from './ask-bar';

describe('AskBar', () => {
  it('has a labelled text box and Send', () => {
    const fixture = TestBed.createComponent(AskBar);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    const box = element.querySelector('textarea');
    expect(element.querySelector(`label[for="${box?.id}"]`)?.textContent).toContain('Ask Home');
    expect(element.querySelector('button[type="submit"]')?.textContent).toContain('Send');
  });

  it('keeps Send from reloading the page', () => {
    const fixture = TestBed.createComponent(AskBar);
    fixture.detectChanges();
    const submit = new Event('submit', { cancelable: true });

    (fixture.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(submit);

    expect(submit.defaultPrevented).toBe(true);
  });
});
