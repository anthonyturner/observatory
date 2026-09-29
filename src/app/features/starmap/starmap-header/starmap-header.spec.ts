import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StarmapHeader } from './starmap-header';

function render() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(StarmapHeader);
  fixture.componentRef.setInput('title', 'Review Queue');
  fixture.componentRef.setInput('stamp', 'me/a · 2 open');
  fixture.componentRef.setInput('chips', [
    { id: 'conflicted', colour: '#ff6f5e', count: 1234, text: 'cannot merge', live: true },
    { id: 'failing', colour: '#ff9a3d', count: 0, text: 'checks failing', live: false },
  ]);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('StarmapHeader', () => {
  it('leads up to every project, and names the sky', () => {
    const { element } = render();

    expect(element.querySelector('app-up-link a')?.getAttribute('href')).toBe('/orrery');
    expect(element.querySelector('h1')?.textContent).toBe('Review Queue');
    expect(element.querySelector('.stale')).toBeNull();
  });

  it('lights a live chip, and leaves an empty one inert', () => {
    const { fixture, element } = render();
    const toggled: string[] = [];
    fixture.componentInstance.toggled.subscribe((id) => toggled.push(id));
    const [live, empty] = Array.from(element.querySelectorAll<HTMLButtonElement>('.lg'));

    live.click();
    empty.click();

    expect(toggled).toEqual(['conflicted']);
    expect(live.textContent).toContain('1,234 cannot merge');
    expect(empty.dataset['empty']).toBe('1');
  });

  it('says when the sky has fogged over', () => {
    const { fixture, element } = render();
    fixture.componentRef.setInput('stale', 'fogged · 9 hours old');
    fixture.detectChanges();

    expect(element.querySelector('.stale')?.textContent).toBe('fogged · 9 hours old');
  });
});
