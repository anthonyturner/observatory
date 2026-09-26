import { TestBed } from '@angular/core/testing';
import { StatusLine } from './status-line';

describe('StatusLine', () => {
  it('gives a dot only to readings that have a state', () => {
    const fixture = TestBed.createComponent(StatusLine);
    fixture.componentRef.setInput('items', [
      { label: 'Core · Idle', state: 'idle' },
      { label: 'Local' },
    ]);
    fixture.detectChanges();

    const items = (fixture.nativeElement as HTMLElement).querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('.dot')).not.toBeNull();
    expect(items[0].dataset['state']).toBe('idle');
    expect(items[1].querySelector('.dot')).toBeNull();
  });
});
