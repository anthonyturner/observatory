import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PrincipleOfDay, ShownPrinciple } from '../../../core/principles/principle-of-day';
import { PrincipleCard } from './principle-card';

const SHOWN: ShownPrinciple = {
  principle: {
    id: 'design-it-twice',
    title: 'Design it twice',
    idea: 'Your first idea is rarely your best.',
    question: 'What was your second idea today?',
  },
  place: 7,
  count: 18,
  isToday: true,
};

function render(shown: ShownPrinciple | null) {
  const current = signal(shown);
  const principles = {
    shown: computed(() => current()),
    next: vi.fn(),
    previous: vi.fn(),
    backToToday: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [{ provide: PrincipleOfDay, useValue: principles }],
  });
  const fixture = TestBed.createComponent(PrincipleCard);
  fixture.detectChanges();
  return { element: fixture.nativeElement as HTMLElement, principles, current, fixture };
}

const button = (element: HTMLElement, label: string): HTMLButtonElement => {
  const found = element.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!found) throw new Error(`no ${label} button`);
  return found;
};

describe('PrincipleCard', () => {
  it('shows the principle, what it means and the question, and which of how many it is', () => {
    const { element } = render(SHOWN);

    expect(element.querySelector('h2')?.textContent).toContain('Principle of the day');
    expect(element.querySelector('h2 small')?.textContent).toBe('today · 7 of 18');
    expect(element.querySelector('h3')?.textContent).toBe('Design it twice');
    expect(element.querySelector('.idea')?.textContent).toBe(
      'Your first idea is rarely your best.',
    );
    expect(element.querySelector('.question')?.textContent).toContain(
      'What was your second idea today?',
    );
  });

  it('steps to the next, the previous and back to today’s from its labelled buttons', () => {
    const { element, principles } = render(SHOWN);

    button(element, 'Next principle').click();
    button(element, 'Previous principle').click();
    button(element, 'Back to today’s principle').click();

    expect(principles.next).toHaveBeenCalledTimes(1);
    expect(principles.previous).toHaveBeenCalledTimes(1);
    expect(principles.backToToday).toHaveBeenCalledTimes(1);
  });

  it('marks Today’s as having nothing to do only while today’s is on show', () => {
    const { element, current, fixture } = render(SHOWN);
    const today = () => button(element, 'Back to today’s principle');
    expect(today().getAttribute('aria-disabled')).toBe('true');

    current.set({ ...SHOWN, place: 8, isToday: false });
    fixture.detectChanges();

    expect(today().getAttribute('aria-disabled')).toBe('false');
    expect(element.querySelector('h2 small')?.textContent).toBe('8 of 18');
  });

  it('shows nothing until the principles are read', () => {
    expect(render(null).element.textContent?.trim()).toBe('');
  });
});
