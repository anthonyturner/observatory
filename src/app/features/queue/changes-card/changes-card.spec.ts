import { TestBed } from '@angular/core/testing';
import { Changes } from '../../../core/queue/changes';
import { ChangesCard, changeGroups, changesHeading } from './changes-card';

const changes: Changes = {
  since: '2026-09-25T14:02:00',
  basis: 'visit',
  opened: [{ number: 5, title: 'Add a thing' }],
  blocked: [{ number: 1, title: 'Fix the build' }],
  unblocked: [],
  merged: [{ number: 4, title: 'Tidy up' }],
  closed: [],
};

describe('changeGroups', () => {
  it('lists the kinds that happened, most pressing first', () => {
    expect(changeGroups(changes).map((group) => [group.label, group.isOpen])).toEqual([
      ['Became blocked', true],
      ['New', true],
      ['Merged', false],
    ]);
  });
});

describe('changesHeading', () => {
  it('says what the changes are counted from', () => {
    expect(changesHeading(changes, 'en-US')).toBe('since you last looked · Sep 25, 02:02 PM');
    expect(changesHeading({ ...changes, basis: 'refresh' }, 'en-US')).toContain(
      'since the refresh before',
    );
  });
});

describe('ChangesCard', () => {
  function render() {
    const fixture = TestBed.createComponent(ChangesCard);
    fixture.componentRef.setInput('changes', changes);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('counts the changes, opens an open one, and asks to clear them', () => {
    const { fixture, element } = render();
    const picked: number[] = [];
    let acknowledged = 0;
    fixture.componentInstance.picked.subscribe((number) => picked.push(number));
    fixture.componentInstance.acknowledged.subscribe(() => acknowledged++);

    expect(element.querySelector('h2')?.textContent).toContain('3 changes');
    element.querySelector<HTMLButtonElement>('li button')?.click();
    element.querySelector<HTMLButtonElement>('.ack')?.click();

    expect(picked).toEqual([1]);
    expect(acknowledged).toBe(1);
    expect(element.querySelector('.gone')?.textContent).toContain('#4');
  });
});
