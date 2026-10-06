import { TestBed } from '@angular/core/testing';
import { STARMAP_SCORE } from '../sound/starmap-sound';
import { HelpState } from '../../../shared/help/help-state';
import { Chart } from '../starmap-view';
import { StarmapTools } from './starmap-tools';
import { BlackHoleSetting } from '../black-hole/black-hole-setting';

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
      ['Next star', 'Sprint', 'Collisions', 'Merge plan', 'Agents', 'Done'],
      ['Refresh', 'Motion on', 'Sound off', '?'],
    ]);
    expect(element.querySelector('.hint')?.textContent).toBe(
      'drag · scroll · hover or click a star',
    );
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

  it('offers Next star only on the queue, naming the pick and why', () => {
    const { fixture, button } = render();
    let asked = 0;
    fixture.componentInstance.nextStar.subscribe(() => asked++);
    expect(button('Next star')?.disabled).toBe(true);
    expect(button('Next star')?.title).toBe('Nothing in the queue to work next');

    fixture.componentRef.setInput('next', {
      pr: 7,
      title: 'Fix it',
      why: 'Cannot merge, idle 6 days',
    });
    fixture.detectChanges();
    button('Next star')?.click();

    expect(asked).toBe(1);
    expect(button('Next star')?.title).toBe('Next star (n): #7 Fix it — Cannot merge, idle 6 days');
    fixture.componentRef.setInput('chart', 'logs');
    fixture.detectChanges();
    expect(button('Next star')).toBeUndefined();
  });

  it('asks for the review sprint, and leaves a running one to its panel', () => {
    const { fixture, button } = render();
    let asked = 0;
    fixture.componentInstance.sprint.subscribe(() => asked++);
    expect(button('Sprint')?.getAttribute('aria-pressed')).toBe('false');

    button('Sprint')?.click();
    fixture.componentRef.setInput('sprintPhase', 'setup');
    fixture.detectChanges();
    expect(asked).toBe(1);
    expect(button('Sprint')?.getAttribute('aria-pressed')).toBe('true');

    fixture.componentRef.setInput('sprintPhase', 'running');
    fixture.detectChanges();
    expect(button('Sprint')?.disabled).toBe(true);
    expect(button('Sprint')?.title).toBe('A review sprint is on: its panel ends it');
  });

  it('shows the volume slider only while the sound is on', () => {
    const { fixture, element, button } = render();
    expect(element.querySelector('.vol')).toBeNull();

    button('Sound off')?.click();
    fixture.detectChanges();

    expect(button('Sound on')).toBeDefined();
    expect(element.querySelector<HTMLInputElement>('.vol input')?.value).toBe('70');
  });

  it('sets the black hole’s threshold on the queue, keeping it in range', () => {
    const { fixture, element } = render();
    const field = element.querySelector<HTMLInputElement>('.hole input');
    expect(field?.value).toBe('14');

    if (field) field.value = '30';
    field?.dispatchEvent(new Event('change'));
    expect(TestBed.inject(BlackHoleSetting).staleAfterDays()).toBe(30);
    if (field) field.value = '500';
    field?.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(field?.value).toBe('90');
  });

  it('offers the threshold only over the queue', () => {
    expect(render('logs').element.querySelector('.hole')).toBeNull();
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
