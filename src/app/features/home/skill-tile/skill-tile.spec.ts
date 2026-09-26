import { TestBed } from '@angular/core/testing';
import { Skill } from '../data/skills';
import { SkillTile } from './skill-tile';

function render(skill: Skill): HTMLElement {
  const fixture = TestBed.createComponent(SkillTile);
  fixture.componentRef.setInput('skill', skill);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('SkillTile', () => {
  it('names its task, with its description as the tooltip', () => {
    const button = render({
      id: 'stale',
      label: 'Find stale PRs',
      description: 'Idle a week',
    }).querySelector('button');

    expect(button?.textContent).toContain('Find stale PRs');
    expect(button?.title).toBe('Idle a week');
  });

  it('says which project it runs in only when it names one', () => {
    expect(render({ id: 'a', label: 'A' }).querySelector('.where')).toBeNull();
    expect(
      render({ id: 'b', label: 'B', project: 'observatory' }).querySelector('.where')?.textContent,
    ).toBe('in observatory');
  });
});
