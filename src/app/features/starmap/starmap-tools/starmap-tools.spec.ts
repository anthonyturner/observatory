import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { LIVE_AGENTS_API } from '../../../core/live-agents/live-agents-api';
import { fakeLiveAgentsApi } from '../../../core/live-agents/testing/live-agent-fixture';
import { STARMAP_SCORE } from '../sound/starmap-sound';
import { HelpState } from '../../../shared/help/help-state';
import { Chart } from '../starmap-view';
import { StarmapTools } from './starmap-tools';
import { BlackHoleSetting } from '../black-hole/black-hole-setting';
import { WipLimitSetting } from '../wip-limit/wip-limit-setting';

function render(chart: Chart = 'prs') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ELEMENT_SIZE, useValue: () => NEVER },
      { provide: LIVE_AGENTS_API, useValue: fakeLiveAgentsApi() },
      {
        provide: STARMAP_SCORE,
        useValue: () => ({
          start: async () => undefined,
          stop: () => undefined,
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
  document.body.append(element);
  const button = (words: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === words,
    );
  const toolsButton = element.querySelector<HTMLButtonElement>('.toolsbutton') as HTMLButtonElement;
  const sheet = element.querySelector<HTMLElement>('.tools') as HTMLElement;
  const settingsButton = element.querySelector<HTMLButtonElement>(
    '.settingstrigger button',
  ) as HTMLButtonElement;
  return { fixture, element, button, toolsButton, sheet, settingsButton };
}

const escape = () => new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });

/** The groups in the dock's reading order, as their button labels. */
function groupsOf(element: HTMLElement): (string | undefined)[][] {
  return Array.from(element.querySelectorAll('.toolgroup:not(.settingstrigger)')).map((g) =>
    Array.from(g.querySelectorAll('button')).map((b) => b.textContent?.trim()),
  );
}

describe('StarmapTools', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => document.body.replaceChildren());

  it('groups its controls by purpose, in the dock’s order and two rows', () => {
    const { element } = render();

    expect(groupsOf(element)).toEqual([
      ['Pull requests', 'Logs', 'Issues', 'Usage', 'Retro'],
      ['Starmap', 'List'],
      ['−', '+', 'Fit'],
      ['Next star', 'Sprint'],
      ['Collisions'],
      ['Merge plan', 'Agents', 'Done'],
      ['Motion on', 'Sound off'],
      ['Refresh'],
      ['?'],
    ]);
    expect(
      Array.from(element.querySelectorAll('.line')).map(
        (row) => row.querySelectorAll('.toolgroup:not(.settingstrigger)').length,
      ),
    ).toEqual([5, 4]);
    expect(element.querySelector('.hint')?.textContent).toBe(
      'drag · scroll · hover or click a star',
    );
  });

  it('keeps the set-and-forget tools together in Settings, and the rest out of it', () => {
    const { element } = render();
    const settings = element.querySelector<HTMLElement>('.settingspanel') as HTMLElement;

    expect(settings.getAttribute('aria-label')).toBe('Settings');
    expect(settings.querySelector('.wip input')).not.toBeNull();
    expect(settings.querySelector('.hole input')).not.toBeNull();
    expect(settings.textContent).toContain('Motion on');
    expect(settings.textContent).toContain('Sound off');
    expect(settings.textContent).not.toContain('Refresh');
    expect(settings.textContent).not.toContain('Next star');
  });

  it('offers Timeline only once the timeline has days, pressed while it is open', () => {
    const { fixture, button } = render();
    expect(button('Timeline')).toBeUndefined();

    fixture.componentRef.setInput('timelineReady', true);
    fixture.detectChanges();
    let asked = 0;
    fixture.componentInstance.timeline.subscribe(() => asked++);
    button('Timeline')?.click();
    expect(asked).toBe(1);
    expect(button('Timeline')?.getAttribute('aria-pressed')).toBe('false');

    fixture.componentRef.setInput('timelineOn', true);
    fixture.detectChanges();
    expect(button('Timeline')?.getAttribute('aria-pressed')).toBe('true');
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

  it('keeps only what a list uses over the list', () => {
    const { fixture, element } = render();
    fixture.componentRef.setInput('view', 'list');
    fixture.detectChanges();

    expect(groupsOf(element)).toEqual([
      ['Pull requests', 'Logs', 'Issues', 'Usage', 'Retro'],
      ['Starmap', 'List'],
      ['Next star', 'Sprint'],
      ['Motion on', 'Sound off'],
      ['Refresh'],
      ['?'],
    ]);
    expect(element.querySelector('.hole')).toBeNull();
    expect(element.querySelector('.hint')).toBeNull();
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

  it('sets the work-in-progress limit on the queue, keeping it in range', () => {
    const { fixture, element } = render();
    const field = element.querySelector<HTMLInputElement>('.wip input');
    expect(field?.value).toBe('8');

    if (field) field.value = '5';
    field?.dispatchEvent(new Event('change'));
    expect(TestBed.inject(WipLimitSetting).limit()).toBe(5);
    if (field) field.value = '';
    field?.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(field?.value).toBe('8');
  });

  it('offers the limit only over the queue', () => {
    expect(render('logs').element.querySelector('.wip')).toBeNull();
  });

  it('opens help', () => {
    const { button } = render();

    button('?')?.click();

    expect(TestBed.inject(HelpState).isOpen()).toBe(true);
  });

  describe('the Tools drawer', () => {
    it('is a region named for the tools, closed until the Tools button opens it', () => {
      const { fixture, sheet, toolsButton } = render();

      expect(sheet.getAttribute('role')).toBe('region');
      expect(sheet.getAttribute('aria-label')).toBe('Review Queue tools');
      expect(toolsButton.getAttribute('aria-controls')).toBe(sheet.id);
      expect(toolsButton.getAttribute('aria-expanded')).toBe('false');
      expect(sheet.classList.contains('open')).toBe(false);

      toolsButton.click();
      fixture.detectChanges();

      expect(toolsButton.getAttribute('aria-expanded')).toBe('true');
      expect(sheet.classList.contains('open')).toBe(true);
      expect(fixture.nativeElement.hasAttribute('data-open')).toBe(true);
    });

    it('closes on Escape and puts focus back on the Tools button', () => {
      const { fixture, sheet, toolsButton, button } = render();
      toolsButton.click();
      fixture.detectChanges();
      button('Fit')?.focus();

      button('Fit')?.dispatchEvent(escape());
      fixture.detectChanges();

      expect(sheet.classList.contains('open')).toBe(false);
      expect(document.activeElement).toBe(toolsButton);
    });

    it('closes on a press outside it', () => {
      const { fixture, sheet, toolsButton } = render();
      toolsButton.click();
      fixture.detectChanges();

      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      fixture.detectChanges();

      expect(sheet.classList.contains('open')).toBe(false);
    });

    it('closes when a tool opens another surface, handing focus back to Tools', () => {
      const { fixture, sheet, toolsButton, button } = render();
      fixture.componentRef.setInput('timelineReady', true);
      fixture.componentRef.setInput('next', { pr: 7, title: 'Fix it', why: 'idle' });
      const asked: string[] = [];
      const instance = fixture.componentInstance;
      instance.timeline.subscribe(() => asked.push('timeline'));
      instance.nextStar.subscribe(() => asked.push('next'));
      instance.sprint.subscribe(() => asked.push('sprint'));
      instance.plan.subscribe(() => asked.push('plan'));
      instance.agents.subscribe(() => asked.push('agents'));
      instance.done.subscribe(() => asked.push('done'));
      instance.chartChange.subscribe(() => asked.push('sky'));
      fixture.detectChanges();

      for (const label of [
        'Timeline',
        'Next star',
        'Sprint',
        'Merge plan',
        'Agents',
        'Done',
        'Logs',
        '?',
      ]) {
        toolsButton.click();
        fixture.detectChanges();
        expect(sheet.classList.contains('open')).toBe(true);

        button(label)?.click();
        fixture.detectChanges();

        expect(sheet.classList.contains('open'), label).toBe(false);
        expect(document.activeElement, label).toBe(toolsButton);
      }
      expect(asked).toEqual(['timeline', 'next', 'sprint', 'plan', 'agents', 'done', 'sky']);
    });

    it('stays open for a setting, leaving focus where it was', () => {
      const { fixture, element, sheet, toolsButton, button } = render();
      let refreshed = 0;
      fixture.componentInstance.refresh.subscribe(() => refreshed++);
      toolsButton.click();
      fixture.detectChanges();

      for (const label of ['Starmap', 'List', '−', '+', 'Fit', 'Collisions', 'Refresh']) {
        button(label)?.focus();
        button(label)?.click();
        fixture.detectChanges();
        expect(sheet.classList.contains('open'), label).toBe(true);
        expect(document.activeElement, label).toBe(button(label));
      }
      button('Motion on')?.click();
      button('Sound off')?.click();
      element.querySelector('.hole input')?.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(refreshed).toBe(1);
      expect(sheet.classList.contains('open')).toBe(true);
    });

    it('does not read or write the retired Controls fold', () => {
      localStorage.setItem('observatory.folded', '1');
      const read = vi.spyOn(Storage.prototype, 'getItem');
      const write = vi.spyOn(Storage.prototype, 'setItem');

      const { fixture, button, toolsButton } = render();
      toolsButton.click();
      fixture.detectChanges();

      expect(button('Controls ▾')).toBeUndefined();
      expect(toolsButton.getAttribute('aria-expanded')).toBe('true');
      expect(read.mock.calls.map(([key]) => key)).not.toContain('observatory.folded');
      expect(write.mock.calls.map(([key]) => key)).not.toContain('observatory.folded');
      vi.restoreAllMocks();
    });
  });

  describe('Settings', () => {
    it('is a list above its button on the dock, opened and closed from the keyboard', () => {
      const { fixture, element, settingsButton } = render();
      const panel = element.querySelector<HTMLElement>('.settingspanel') as HTMLElement;
      expect(settingsButton.getAttribute('aria-expanded')).toBe('false');
      expect(settingsButton.getAttribute('aria-controls')).toBe(panel.id);

      settingsButton.click();
      fixture.detectChanges();
      expect(settingsButton.getAttribute('aria-expanded')).toBe('true');
      expect(panel.classList.contains('open')).toBe(true);

      panel.querySelector('input')?.dispatchEvent(escape());
      fixture.detectChanges();

      expect(panel.classList.contains('open')).toBe(false);
      expect(document.activeElement).toBe(settingsButton);
    });

    it('closes only the Settings list on Escape, not the Tools drawer', () => {
      const { fixture, sheet, toolsButton, settingsButton } = render();
      toolsButton.click();
      settingsButton.click();
      fixture.detectChanges();

      settingsButton.dispatchEvent(escape());
      fixture.detectChanges();

      expect(sheet.classList.contains('open')).toBe(true);
    });
  });
});
