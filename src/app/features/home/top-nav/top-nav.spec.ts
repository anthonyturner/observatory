import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { HelpState } from '../help/help-state';
import { TopNav } from './top-nav';

describe('TopNav', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('leads to the orrery inside the app', () => {
    const fixture = TestBed.createComponent(TopNav);
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a.link');
    expect(link?.getAttribute('href')).toBe('/orrery');
  });

  it('opens help from the ? button and shows it pressed', () => {
    const fixture = TestBed.createComponent(TopNav);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label="Help"]',
    );

    button?.click();
    fixture.detectChanges();

    expect(TestBed.inject(HelpState).isOpen()).toBe(true);
    expect(button?.getAttribute('aria-pressed')).toBe('true');
  });

  it('switches motion from the Motion button and says which way it is', () => {
    localStorage.clear();
    const fixture = TestBed.createComponent(TopNav);
    fixture.detectChanges();
    const button = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).find((b) => b.textContent?.includes('Motion'));
    const wasStill = TestBed.inject(MotionPreference).isStill();

    button?.click();
    fixture.detectChanges();

    expect(TestBed.inject(MotionPreference).isStill()).toBe(!wasStill);
    expect(button?.textContent?.trim()).toBe(wasStill ? 'Motion on' : 'Motion off');
    expect(button?.getAttribute('aria-pressed')).toBe(String(wasStill));
  });
});
