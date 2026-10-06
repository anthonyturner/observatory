import { TestBed } from '@angular/core/testing';
import { WipNotice } from './wip-notice';

describe('WipNotice', () => {
  it('says how many are open against the limit, as a status', () => {
    const fixture = TestBed.createComponent(WipNotice);
    fixture.componentRef.setInput('check', { open: 9, limit: 8, isOver: true });
    fixture.detectChanges();
    const notice = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');

    expect(notice?.querySelector('strong')?.textContent).toBe('9 open');
    expect(notice?.textContent).toContain('past your limit of 8');
  });
});
