import { TestBed } from '@angular/core/testing';
import { HelpCard } from './help-card';
import { HelpState } from './help-state';

const ENTRIES = [
  { term: 'Comets', meaning: 'Open issues.' },
  { term: 'Fog', meaning: 'Old data.' },
];
const KEYS = [{ key: '?', action: 'help' }];

describe('HelpCard', () => {
  function render() {
    const fixture = TestBed.createComponent(HelpCard);
    fixture.componentRef.setInput('title', 'Star map');
    fixture.componentRef.setInput('entries', ENTRIES);
    fixture.componentRef.setInput('keys', KEYS);
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

  it('shows the page’s title, terms and keys', () => {
    const { fixture, help, element } = render();
    help.toggle();
    fixture.detectChanges();

    const terms = Array.from(element.querySelectorAll('dt')).map((dt) => dt.textContent?.trim());
    expect(element.querySelector('h2')?.textContent).toBe('Star map');
    expect(terms).toEqual(['Comets', 'Fog']);
    expect(element.querySelector('kbd')?.textContent).toBe('?');
  });

  it('heads each run of entries with its section, in the page’s order', () => {
    const { fixture, help, element } = render();
    fixture.componentRef.setInput('entries', [
      { term: 'Comets', meaning: 'Open issues.', section: 'The sky' },
      { term: 'Fog', meaning: 'Old data.', section: 'The sky' },
      { term: 'Ask', meaning: 'Type a request.', section: 'Working' },
    ]);
    help.toggle();
    fixture.detectChanges();

    const headings = Array.from(element.querySelectorAll('h3')).map((h) => h.textContent);
    expect(headings).toEqual(['The sky', 'Working']);
    expect(element.querySelectorAll('dl')[0].querySelectorAll('dt').length).toBe(2);
  });

  it('draws no headings for a page whose entries have no sections', () => {
    const { fixture, help, element } = render();
    help.toggle();
    fixture.detectChanges();

    expect(element.querySelector('h3')).toBeNull();
  });

  it('closes when its page goes', () => {
    const { fixture, help } = render();
    help.toggle();
    fixture.detectChanges();

    fixture.destroy();

    expect(help.isOpen()).toBe(false);
  });
});
