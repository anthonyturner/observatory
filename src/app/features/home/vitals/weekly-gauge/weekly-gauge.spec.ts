import { TestBed } from '@angular/core/testing';
import { WeeklyUsage } from '../../data/vitals';
import { WeeklyGauge } from './weekly-gauge';

function render(usage: WeeklyUsage): HTMLElement {
  const fixture = TestBed.createComponent(WeeklyGauge);
  fixture.componentRef.setInput('usage', usage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('WeeklyGauge', () => {
  it('fills the meter to the percent used and turns hot from 80%', () => {
    const element = render({ percentUsed: 86, note: 'resets Mon' });

    expect(element.querySelector('.reading b')?.textContent).toBe('86');
    expect(element.querySelector<HTMLElement>('.fill')?.style.width).toBe('86%');
    expect(element.classList.contains('hot')).toBe(true);
  });

  it('shows unknown with an empty meter when there is no reading', () => {
    const element = render({ percentUsed: null, note: 'no limit readings yet' });

    expect(element.querySelector('.reading')?.textContent).toContain('unknown');
    expect(element.querySelector('.fill')).toBeNull();
    expect(element.classList.contains('hot')).toBe(false);
  });
});
