import { TestBed } from '@angular/core/testing';
import { STARMAP_SCORE } from '../sound/starmap-sound';
import { HelpState } from '../../../shared/help/help-state';
import { Chart } from '../starmap-view';
import { StarmapTools } from './starmap-tools';

function render(chart: Chart = 'prs') {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: STARMAP_SCORE,
        useValue: () => ({
          start: async () => undefined,
          stop: () => undefined,
          setTension: () => undefined,
          setVolume: () => undefined,
          ping: () => undefined,
        }),
      },
    ],
  });
  const fixture = TestBed.createComponent(StarmapTools);
  fixture.componentRef.setInput('chart', chart);
  fixture.componentRef.setInput('view', 'map');
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = (words: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === words,
    );
  return { fixture, element, button };
}

describe('StarmapTools', () => {
  beforeEach(() => localStorage.clear());

  it('has pr-starmap’s groups, in its order', () => {
    const { element } = render();

    expect(
      Array.from(element.querySelectorAll('.toolgroup')).map((g) =>
        Array.from(g.querySelectorAll('button')).map((b) => b.textContent?.trim()),
      ),
    ).toEqual([
      ['Pull requests', 'Logs', 'Issues', 'Usage'],
      ['−', '+', 'Fit'],
      ['Starmap', 'List'],
      ['Collisions', 'Merge plan', 'Agents'],
      ['Refresh', 'Motion on', 'Sound off', '?'],
    ]);
    expect(element.querySelector('.hint')?.textContent).toBe('drag · scroll · click a star');
  });

  it('asks for another screen, and hides what means nothing there', () => {
    const { fixture, button, element } = render('usage');
    const asked: Chart[] = [];
    fixture.componentInstance.chartChange.subscribe((c) => asked.push(c));

    button('Logs')?.click();
    button('Usage')?.click();

    expect(asked).toEqual(['logs']);
    expect(button('Fit')).toBeUndefined();
    expect(button('Collisions')).toBeUndefined();
    expect(element.querySelector('.hint')).toBeNull();
  });

  it('keeps the queue’s overlays off the issues screen', () => {
    const { button } = render('issues');
    expect(button('Merge plan')).toBeUndefined();
    expect(button('Fit')).toBeDefined();
  });

  it('shows the volume slider only while the sound is on', () => {
    const { fixture, element, button } = render();
    expect(element.querySelector('.vol')).toBeNull();

    button('Sound off')?.click();
    fixture.detectChanges();

    expect(button('Sound on')).toBeDefined();
    expect(element.querySelector<HTMLInputElement>('.vol input')?.value).toBe('70');
  });

  it('opens help, and folds away, remembering the fold', () => {
    const { fixture, button } = render();

    button('?')?.click();
    expect(TestBed.inject(HelpState).isOpen()).toBe(true);
    button('Controls ▾')?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.folded()).toBe(true);
    expect(localStorage.getItem('observatory.folded')).toBe('1');
  });
});
