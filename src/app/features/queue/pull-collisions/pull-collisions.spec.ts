import { TestBed } from '@angular/core/testing';
import { PullCollisions, filesLine } from './pull-collisions';

describe('filesLine', () => {
  it('names a few files and counts the rest', () => {
    expect(filesLine(['a', 'b'])).toBe('a, b');
    expect(filesLine(['a', 'b', 'c', 'd', 'e'])).toBe('a, b, c and 2 more');
  });
});

describe('PullCollisions', () => {
  function render(check: 'checked' | 'no-clone') {
    const fixture = TestBed.createComponent(PullCollisions);
    fixture.componentRef.setInput('check', check);
    fixture.componentRef.setInput('collisions', [
      { other: 12, kind: check === 'checked' ? 'conflict' : 'unchecked', files: ['src/a.ts'] },
    ]);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('says which it would conflict with, and opens it', () => {
    const { fixture, element } = render('checked');
    const picked: number[] = [];
    fixture.componentInstance.picked.subscribe((number) => picked.push(number));

    expect(element.textContent).toContain('Would conflict with');
    expect(element.textContent).toContain('src/a.ts');
    expect(element.querySelector('.why')).toBeNull();
    element.querySelector('button')?.click();
    expect(picked).toEqual([12]);
  });

  it('says why nothing was checked', () => {
    expect(render('no-clone').element.querySelector('.why')?.textContent).toContain(
      'No local clone',
    );
  });
});
