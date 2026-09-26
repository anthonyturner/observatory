import { TestBed } from '@angular/core/testing';
import { SkyItem } from '../engine/sky-model';
import { StarmapPrList, prDetail, prSections } from './starmap-pr-list';

const item = (pr: number, bucket: SkyItem['bucket'], issues: number[] = []): SkyItem => ({
  pr,
  title: `Change ${pr}`,
  bucket,
  idleDays: 4,
  additions: 10,
  deletions: 2,
  issues,
});

const items = [item(1, 'unreviewed', [9]), item(2, 'conflicted'), item(3, 'unreviewed')];

describe('prSections', () => {
  it('lists each bucket in pr-starmap order, narrowed by the legend', () => {
    expect(prSections(items, null).map((s) => [s.label, s.items.length])).toEqual([
      ['Aporia', 1],
      ['Vigilia', 2],
    ]);
    expect(prSections(items, 'conflicted').map((s) => s.id)).toEqual(['conflicted']);
    expect(prSections(items, 'quick').flatMap((s) => s.items.map((i) => i.pr))).toEqual([1, 3]);
  });

  it('says what a row closes and how long it has sat', () => {
    expect(prDetail(items[0])).toBe('closes #9 · idle 4d');
    expect(prDetail(items[1])).toBe('closes nothing · idle 4d');
  });
});

describe('StarmapPrList', () => {
  it('flies to a star from a row, by click or key', () => {
    const fixture = TestBed.createComponent(StarmapPrList);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    const went: number[] = [];
    fixture.componentInstance.go.subscribe((pr) => went.push(pr));
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('li');

    rows[0].click();
    rows[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(went).toEqual([2, 1]);
    expect((fixture.nativeElement as HTMLElement).querySelector('h3')?.textContent).toContain(
      'Cannot merge · 1',
    );
  });
});
