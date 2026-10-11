import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WipCheck } from '../wip-check';
import { WipNotice } from './wip-notice';

function render(check: WipCheck) {
  const fixture = TestBed.createComponent(WipNotice);
  fixture.componentRef.setInput('check', check);
  fixture.detectChanges();
  return fixture;
}

function notice(fixture: ComponentFixture<WipNotice>): HTMLElement | null {
  return (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
}

function close(fixture: ComponentFixture<WipNotice>): void {
  (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.close')?.click();
  fixture.detectChanges();
}

function setCheck(fixture: ComponentFixture<WipNotice>, check: WipCheck): void {
  fixture.componentRef.setInput('check', check);
  fixture.detectChanges();
}

describe('WipNotice', () => {
  it('says how many are open against the limit, as a status', () => {
    const fixture = render({ open: 9, limit: 8, isOver: true });

    expect(notice(fixture)?.querySelector('strong')?.textContent).toBe('9 open');
    expect(notice(fixture)?.textContent).toContain('past your limit of 8');
  });

  it('says nothing under the limit', () => {
    const fixture = render({ open: 8, limit: 8, isOver: false });

    expect(notice(fixture)).toBeNull();
  });

  it('closes with a labelled button', () => {
    const fixture = render({ open: 9, limit: 8, isOver: true });
    const button = (fixture.nativeElement as HTMLElement).querySelector('.close');

    expect(button?.getAttribute('aria-label')).toBe('Close the work-in-progress notice');
    close(fixture);

    expect(notice(fixture)).toBeNull();
  });

  it('stays closed while the count and the limit hold, even as the check is read again', () => {
    const fixture = render({ open: 9, limit: 8, isOver: true });
    close(fixture);

    setCheck(fixture, { open: 9, limit: 8, isOver: true });

    expect(notice(fixture)).toBeNull();
  });

  it('returns when the open count changes', () => {
    const fixture = render({ open: 9, limit: 8, isOver: true });
    close(fixture);

    setCheck(fixture, { open: 10, limit: 8, isOver: true });

    expect(notice(fixture)?.querySelector('strong')?.textContent).toBe('10 open');
  });

  it('returns when the limit changes', () => {
    const fixture = render({ open: 9, limit: 8, isOver: true });
    close(fixture);

    setCheck(fixture, { open: 9, limit: 7, isOver: true });

    expect(notice(fixture)?.textContent).toContain('past your limit of 7');
  });

  it('keeps quiet while paused, and speaks again when the pause ends', () => {
    const fixture = render({ open: 9, limit: 8, isOver: true });

    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    expect(notice(fixture)).toBeNull();

    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    expect(notice(fixture)).not.toBeNull();
  });
});
