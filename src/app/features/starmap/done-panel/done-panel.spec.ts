import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoneItem } from '../../../core/queue/done-work';
import { DonePanel, dayLabel, doneDays, doneSummary } from './done-panel';

const item = (key: string, kind: DoneItem['kind'], day: string): DoneItem => ({
  key,
  kind,
  number: Number(key.replace(/\D/g, '')),
  title: `Work ${key}`,
  at: new Date(`${day}T12:00:00`).getTime(),
  day,
});
const NOW = new Date('2026-10-05T15:00:00');
const ITEMS = [
  item('pr12', 'merged', '2026-10-05'),
  item('issue9', 'issue', '2026-10-04'),
  item('pr11', 'closed', '2026-09-29'),
];

describe('done list helpers', () => {
  it('names today and yesterday, and dates the rest', () => {
    expect(dayLabel('2026-10-05', NOW)).toBe('Today');
    expect(dayLabel('2026-10-04', NOW)).toBe('Yesterday');
    expect(dayLabel('2026-09-29', NOW, 'en-US')).toBe('Tue, Sep 29');
  });

  it('groups finished work by day, newest day first', () => {
    expect(doneDays(ITEMS, NOW).map((d) => [d.label, d.items.map((i) => i.key)])).toEqual([
      ['Today', ['pr12']],
      ['Yesterday', ['issue9']],
      [dayLabel('2026-09-29', NOW), ['pr11']],
    ]);
  });

  it('sums up what finished, or says nothing has', () => {
    expect(doneSummary(ITEMS)).toBe('1 merged · 1 closed · 1 issue done in 60 days');
    expect(doneSummary([])).toMatch(/Nothing finished/);
  });
});

describe('DonePanel', () => {
  let fixture: ComponentFixture<DonePanel>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DonePanel);
    fixture.componentRef.setInput('items', ITEMS);
    fixture.detectChanges();
  });

  it('lights a row on hover and opens it on click', () => {
    const lit: (string | null)[] = [];
    const opened: DoneItem[] = [];
    fixture.componentInstance.light.subscribe((key) => lit.push(key));
    fixture.componentInstance.open.subscribe((done) => opened.push(done));
    const row = fixture.nativeElement.querySelector('button.row') as HTMLButtonElement;

    row.dispatchEvent(new MouseEvent('mouseenter'));
    row.click();

    expect(lit).toEqual(['pr12']);
    expect(opened.map((d) => d.key)).toEqual(['pr12']);
    expect(row.textContent).toContain('#12');
  });

  it('marks the row the spiral has lit', () => {
    fixture.componentRef.setInput('lit', 'issue9');
    fixture.detectChanges();
    const current = fixture.nativeElement.querySelector('[aria-current="true"]') as HTMLElement;
    expect(current.textContent).toContain('issue 9');
  });
});
