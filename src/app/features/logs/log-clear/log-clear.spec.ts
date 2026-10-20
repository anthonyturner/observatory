import { ComponentFixture, TestBed } from '@angular/core/testing';
import { formatAt } from '../../../core/logs/log-format';
import { LogClear } from './log-clear';

function render(inputs: {
  clearedAt?: string | null;
  isWaiting?: boolean;
  failure?: 'unreachable' | 'rejected' | null;
}) {
  const fixture: ComponentFixture<LogClear> = TestBed.createComponent(LogClear);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = (words: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === words);
  return { fixture, element, button };
}

describe('LogClear', () => {
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
});
