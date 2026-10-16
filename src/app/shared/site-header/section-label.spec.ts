import { TestBed } from '@angular/core/testing';
import { NavSection } from './nav-section';
import { SectionLabel } from './section-label';

function mount(section: NavSection): HTMLElement {
  const fixture = TestBed.createComponent(SectionLabel);
  fixture.componentRef.setInput('section', section);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const base: NavSection = { id: 'milestones', label: 'Milestones', link: '/m' };

describe('SectionLabel', () => {
  it('recedes for a section with nothing in it, and says so to a screen reader', () => {
    const label = mount({ ...base, isQuiet: true });

    expect(label.classList).toContain('recedes');
    expect(label.textContent?.replace(/\s+/g, ' ').trim()).toBe('Milestones , nothing here yet');
  });

  it('stays as it is when the quiet section is the page being read', () => {
    expect(mount({ ...base, isQuiet: true, isCurrent: true }).classList).not.toContain('recedes');
  });

  it('does not recede for a section with something in it', () => {
    expect(mount(base).classList).not.toContain('recedes');
  });
});
