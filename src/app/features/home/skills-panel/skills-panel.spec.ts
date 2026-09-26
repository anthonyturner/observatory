import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SKILLS, Skill } from '../data/skills';
import { SKILLS_SHOWN, SkillsPanel } from './skills-panel';

const skills = (count: number): Skill[] =>
  Array.from({ length: count }, (_, index) => ({ id: `s${index}`, label: `Skill ${index}` }));

function render(list: readonly Skill[]) {
  TestBed.configureTestingModule({ providers: [{ provide: SKILLS, useValue: signal(list) }] });
  const fixture = TestBed.createComponent(SkillsPanel);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const tiles = () => element.querySelectorAll('app-skill-tile').length;
  return { fixture, element, tiles };
}

describe('SkillsPanel', () => {
  it('shows the first few, then browses all and folds them again', () => {
    const { fixture, element, tiles } = render(skills(SKILLS_SHOWN + 2));
    const toggle = element.querySelector<HTMLButtonElement>('.browse button');
    expect(tiles()).toBe(SKILLS_SHOWN);
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');

    toggle?.click();
    fixture.detectChanges();
    expect(tiles()).toBe(SKILLS_SHOWN + 2);
    expect(toggle?.textContent).toContain('Show fewer skills');

    toggle?.click();
    fixture.detectChanges();
    expect(tiles()).toBe(SKILLS_SHOWN);
  });

  it('has nothing to browse when every skill fits', () => {
    const { element, tiles } = render(skills(2));

    expect(tiles()).toBe(2);
    expect(element.querySelector('.browse button')).toBeNull();
  });

  it('says there are no skills yet rather than showing made-up ones', () => {
    const { element } = render([]);

    expect(element.querySelector('.empty')?.textContent).toContain('No skills yet');
    expect(element.querySelector('.browse')?.classList.contains('none')).toBe(true);
  });
});
