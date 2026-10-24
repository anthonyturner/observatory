import { TestBed } from '@angular/core/testing';
import { DiffWrapChoice } from '../../core/queue/diff-wrap-choice';
import { DiffWrapToggle } from './diff-wrap-toggle';

describe('DiffWrapToggle', () => {
  beforeEach(() => localStorage.clear());

  it('shows the shared choice, and changes it for every diff when ticked or cleared', () => {
    const fixture = TestBed.createComponent(DiffWrapToggle);
    fixture.detectChanges();
    const box = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    const choice = TestBed.inject(DiffWrapChoice);
    expect(box.checked).toBe(true);

    box.click();
    fixture.detectChanges();
    expect(choice.wraps()).toBe(false);

    box.click();
    fixture.detectChanges();
    expect(choice.wraps()).toBe(true);
  });

  it('follows a choice made in another tab', () => {
    const fixture = TestBed.createComponent(DiffWrapToggle);
    fixture.detectChanges();
    const box = (fixture.nativeElement as HTMLElement).querySelector('input')!;

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'observatory.diff-wrap', newValue: 'scroll' }),
    );
    fixture.detectChanges();

    expect(box.checked).toBe(false);
  });
});
