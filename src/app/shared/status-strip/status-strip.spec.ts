import { ChangeDetectionStrategy, Component, WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { STATUS_FACT, StatusFact } from './status-fact';
import { StatusStrip } from './status-strip';

const STORAGE_KEY = 'observatory.statusStrip';
const shown = signal(true);

@Component({
  selector: 'app-test-fact',
  template: 'fact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STATUS_FACT, useExisting: TestFact }],
})
class TestFact implements StatusFact {
  readonly isShown: WritableSignal<boolean> = shown;
}

@Component({
  imports: [StatusStrip, TestFact],
  template: `<app-status-strip label="Status details"><app-test-fact /></app-status-strip>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    strip: element.querySelector('app-status-strip') as HTMLElement,
    toggle: element.querySelector('button') as HTMLButtonElement,
  };
}

describe('StatusStrip', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    shown.set(true);
  });
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('shows the facts projected into it', () => {
    const { strip } = render();

    expect(strip.hidden).toBe(false);
    expect(strip.textContent).toContain('fact');
  });

  it('hides while no fact has anything to show', () => {
    const { fixture, strip } = render();

    shown.set(false);
    fixture.detectChanges();
    expect(strip.hidden).toBe(true);

    shown.set(true);
    fixture.detectChanges();
    expect(strip.hidden).toBe(false);
  });

  it('folds to a chip from a labelled toggle that says whether it is open', () => {
    const { fixture, toggle } = render();
    const pill = () => fixture.nativeElement.querySelector('.strip') as HTMLElement;

    expect(toggle.getAttribute('aria-label')).toBe('Status details');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(pill().classList).not.toContain('strip--collapsed');

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(pill().classList).toContain('strip--collapsed');
  });

  it('opens folded when it was folded last visit', () => {
    localStorage.setItem(STORAGE_KEY, 'folded');

    expect(render().toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
