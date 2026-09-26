import { TestBed } from '@angular/core/testing';
import { VitalReading } from '../../data/vitals';
import { VitalReadout } from './vital-readout';

function render(reading: VitalReading): HTMLElement {
  const fixture = TestBed.createComponent(VitalReadout);
  fixture.componentRef.setInput('reading', reading);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('VitalReadout', () => {
  it('shows a known reading as a number with its unit, amber when hot', () => {
    const element = render({
      id: 'five',
      label: '5-hour window',
      value: '84',
      unit: '%',
      isHot: true,
    });

    expect(element.querySelector('.number')?.textContent).toContain('84');
    expect(element.querySelector('.number small')?.textContent).toBe('%');
    expect(element.classList.contains('hot')).toBe(true);
  });

  it('says unknown in words, with why, never as a number', () => {
    const element = render({
      id: 'tokens',
      label: 'Tokens today',
      value: null,
      note: 'not read today',
    });

    const number = element.querySelector('.number');
    expect(number?.classList.contains('unknown')).toBe(true);
    expect(number?.textContent).toContain('unknown');
    expect(number?.textContent).toContain('not read today');
    expect(element.classList.contains('unknown')).toBe(true);
  });
});
