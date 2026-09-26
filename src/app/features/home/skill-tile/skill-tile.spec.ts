import { TestBed } from '@angular/core/testing';
import { Skill } from '../../../core/assistant/assistant.types';
import { SkillTile } from './skill-tile';

function render(skill: Skill, isProposing = false) {
  const fixture = TestBed.createComponent(SkillTile);
  fixture.componentRef.setInput('skill', skill);
  fixture.componentRef.setInput('isProposing', isProposing);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('SkillTile', () => {
  it('names its task, with its description as the tooltip', () => {
    const button = render({
      id: 'stale',
      label: 'Find stale PRs',
      description: 'Idle a week',
    }).element.querySelector('button');

    expect(button?.textContent).toContain('Find stale PRs');
    expect(button?.title).toBe('Idle a week');
  });

  it('says which project it runs in only when it names one', () => {
    expect(render({ id: 'a', label: 'A' }).element.querySelector('.where')).toBeNull();
    expect(
      render({ id: 'b', label: 'B', project: 'observatory' }).element.querySelector('.where')
        ?.textContent,
    ).toBe('in observatory');
  });

  it('reports a press, and says Proposing… until the reply is back', () => {
    const skill = { id: 'stale', label: 'Find stale PRs' };
    const { fixture, element } = render(skill, true);
    const pressed: Skill[] = [];
    fixture.componentInstance.pressed.subscribe((value) => pressed.push(value));

    element.querySelector('button')?.click();

    expect(pressed).toEqual([skill]);
    expect(element.querySelector('button')?.getAttribute('aria-busy')).toBe('true');
    expect(element.textContent).toContain('Proposing…');
  });
});
