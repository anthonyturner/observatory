import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { VitalsColumn } from '../data/vitals';
import { VITALS_COLUMN } from '../data/vitals-column';
import { VitalsPanel } from './vitals-panel';

const column: VitalsColumn = {
  vitals: [{ id: 'issues', label: 'Open issues', value: '7' }],
  weekly: { percentUsed: 10, note: 'resets Mon' },
  directives: {
    items: [
      { title: 'Fix it', href: 'https://github.com/me/a/pull/1', detail: 'a #1', color: 'red' },
    ],
    note: 'Blocked first',
  },
  docs: { links: [{ label: 'Orrery', href: '/orrery' }] },
};

describe('VitalsPanel', () => {
  it('shows every part of the column from the source it is given', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: VITALS_COLUMN, useValue: signal(column) }],
    });
    const fixture = TestBed.createComponent(VitalsPanel);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('app-vital-readout').length).toBe(1);
    expect(element.querySelector('app-weekly-gauge .reading')?.textContent).toContain('10');
    expect(element.querySelector('app-directive-list a')?.textContent).toContain('Fix it');
    expect(element.querySelector('app-doc-tabs a')?.getAttribute('href')).toBe('/orrery');
  });
});
