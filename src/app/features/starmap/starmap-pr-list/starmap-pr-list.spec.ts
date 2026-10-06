import { TestBed } from '@angular/core/testing';
import { SkyItem } from '../engine/sky-model';
import { StarmapPrList, prDetail, prSections, stackLine } from './starmap-pr-list';

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

describe('stackLine', () => {
  it('says what a row is stacked on and what is stacked on it', () => {
    expect(stackLine({ parent: 1, children: [3, 4], landed: null })).toEqual({
      text: 'stacked on #1 · #3, #4 stacked on it',
      isLanded: false,
    });
  });

  it('leads with a merged base, which wants an update', () => {
    const landed = { number: 12, branch: 'feat/12', into: 'main' };

    expect(stackLine({ parent: null, children: [], landed })).toEqual({
      text: 'base #12 merged · update it',
      isLanded: true,
    });
  });
});

describe('StarmapPrList', () => {
  it('shows a stacked row’s chain under it', () => {
    const fixture = TestBed.createComponent(StarmapPrList);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput(
      'stacks',
      new Map([
        [1, { parent: null, children: [3], landed: null }],
        [3, { parent: 1, children: [], landed: null }],
      ]),
    );
    fixture.detectChanges();
    const notes = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.s')];

    expect(notes.map((note) => note.textContent?.trim())).toEqual([
      '#3 stacked on it',
      'stacked on #1',
    ]);
  });

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
