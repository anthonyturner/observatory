import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HomeSummary } from '../data/home-summary';
import { HOME_SUMMARY } from '../data/home-summary-source';
import { TopBar } from './top-bar';

describe('TopBar', () => {
  it('shows the summary it is given', () => {
    const summary: HomeSummary = { stamp: 'refreshed 10:00', statuses: [{ label: 'Hosted' }] };
    TestBed.configureTestingModule({
      providers: [{ provide: HOME_SUMMARY, useValue: signal(summary) }],
    });
    const fixture = TestBed.createComponent(TopBar);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.stamp')?.textContent).toBe('refreshed 10:00');
    expect(element.querySelector('app-status-line')?.textContent).toContain('Hosted');
  });
});
