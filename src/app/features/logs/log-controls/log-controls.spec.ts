import { ComponentFixture, TestBed } from '@angular/core/testing';
import { formatAt } from '../../../core/logs/log-format';
import { LogControls } from './log-controls';

function render(inputs: {
  canClear?: boolean;
  clearedAt?: string | null;
  isWaiting?: boolean;
  failure?: 'unreachable' | 'rejected' | null;
  olderCount?: number;
  isShowingOlder?: boolean;
}) {
  const fixture: ComponentFixture<LogControls> = TestBed.createComponent(LogControls);
  fixture.componentRef.setInput('canClear', true);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = (words: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === words);
  return { fixture, element, button };
}

describe('LogControls', () => {
  it('offers only Clear while every line counts', () => {
    const { element, button } = render({});

    expect(button('Clear')).toBeDefined();
    expect(button('Reset')).toBeUndefined();
    expect(element.querySelector('.note')).toBeNull();
  });

  it('adds Reset and says when the sky was cleared', () => {
    const { element, button } = render({ clearedAt: '2026-10-20T09:30:00' });

    expect(button('Reset')).toBeDefined();
    expect(element.querySelector('.note')?.textContent).toContain(
      `Cleared ${formatAt('2026-10-20T09:30:00')}`,
    );
  });

  it('reports a press of each, and none while a change is on its way', () => {
    const { fixture, button } = render({ clearedAt: '2026-10-20T09:30:00' });
    const pressed: string[] = [];
    fixture.componentInstance.cleared.subscribe(() => pressed.push('clear'));
    fixture.componentInstance.restored.subscribe(() => pressed.push('reset'));

    button('Clear')?.click();
    button('Reset')?.click();
    fixture.componentRef.setInput('isWaiting', true);
    fixture.detectChanges();

    expect(pressed).toEqual(['clear', 'reset']);
    expect(button('Clear')?.disabled).toBe(true);
    expect(button('Reset')?.disabled).toBe(true);
  });

  it('says when the API could not be reached, and otherwise only that it did not go through', () => {
    const unreachable = render({ failure: 'unreachable' });
    expect(unreachable.element.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not reach the API',
    );
    TestBed.resetTestingModule();

    const rejected = render({ failure: 'rejected' });
    expect(rejected.element.querySelector('[role="alert"]')?.textContent).toContain(
      'The change did not go through.',
    );
  });

  it('offers no Clear or Reset where the sky cannot be cleared', () => {
    const { button } = render({ canClear: false, clearedAt: '2026-10-20T09:30:00', olderCount: 2 });

    expect(button('Clear')).toBeUndefined();
    expect(button('Reset')).toBeUndefined();
    expect(button('Show 2 older')).toBeDefined();
  });

  it('draws nothing when there is nothing to clear or show', () => {
    const { element } = render({ canClear: false });

    expect(element.querySelector('.controls')).toBeNull();
  });

  it('has no older toggle when no fault is older', () => {
    const { element } = render({ olderCount: 0 });

    expect(element.textContent).not.toContain('older');
  });

  it('counts the older faults on a toggle that says what the next press does', () => {
    const { fixture, button } = render({ olderCount: 1234 });
    const pressed: string[] = [];
    fixture.componentInstance.olderToggled.subscribe(() => pressed.push('older'));

    button('Show 1,234 older')?.click();
    fixture.componentRef.setInput('isShowingOlder', true);
    fixture.detectChanges();

    expect(pressed).toEqual(['older']);
    expect(button('Show 1,234 older')).toBeUndefined();
    expect(button('Hide 1,234 older')).toBeDefined();
  });

  it('keeps the older toggle working while a clear is on its way', () => {
    const { button } = render({ olderCount: 3, isWaiting: true });

    expect(button('Show 3 older')?.disabled).toBe(false);
    expect(button('Clear')?.disabled).toBe(true);
  });
});
