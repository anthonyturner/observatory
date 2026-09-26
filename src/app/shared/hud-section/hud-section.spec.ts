import { TestBed } from '@angular/core/testing';
import { HudSection } from './hud-section';

describe('HudSection', () => {
  function render(heading: string, note?: string): HTMLElement {
    const fixture = TestBed.createComponent(HudSection);
    fixture.componentRef.setInput('heading', heading);
    if (note) fixture.componentRef.setInput('note', note);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('names its section by its heading', () => {
    const element = render('Skills', 'quick access');
    const section = element.querySelector('section');
    const heading = element.querySelector('h2');

    expect(heading?.textContent).toContain('Skills');
    expect(heading?.querySelector('small')?.textContent).toBe('quick access');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
  });

  it('leaves the note out when there is none', () => {
    expect(render('Skills').querySelector('small')).toBeNull();
  });
});
