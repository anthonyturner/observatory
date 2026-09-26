import { TestBed } from '@angular/core/testing';
import { HelpCard } from './help-card';
import { HelpState } from './help-state';

describe('HelpCard', () => {
  function render() {
    const fixture = TestBed.createComponent(HelpCard);
    const help = TestBed.inject(HelpState);
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, help, element };
  }

  it('shows nothing while closed', () => {
    const { fixture, element } = render();
    fixture.detectChanges();

    expect(element.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens as a labelled dialog and closes from its own button', () => {
    const { fixture, help, element } = render();
    help.toggle();
    fixture.detectChanges();

    const dialog = element.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('help-title');
    expect(element.querySelectorAll('dt').length).toBeGreaterThan(0);

    element.querySelector<HTMLButtonElement>('.close')?.click();
    fixture.detectChanges();

    expect(help.isOpen()).toBe(false);
    expect(element.querySelector('[role="dialog"]')).toBeNull();
  });

  it('explains what the comets mean', () => {
    const { fixture, help, element } = render();
    help.toggle();
    fixture.detectChanges();

    const terms = Array.from(element.querySelectorAll('dt')).map((dt) => dt.textContent?.trim());
    expect(terms).toContain('Comets');
    expect(terms).toContain('Fog');
  });
});
