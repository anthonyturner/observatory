import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { PAGE_REFRESH } from '../../../core/projects/projects-refresh';
import { TrailActivity } from '../../../core/sky/trail-activity';
import { TRAIL_SPEEDS, TrailSpeed } from '../../../core/sky/trail-speed';
import { HelpState } from '../../../shared/help/help-state';
import { HomeTools } from './home-tools';

function render() {
  const fixture = TestBed.createComponent(HomeTools);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = (words: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(words),
    );
  return { fixture, element, button };
}

describe('HomeTools', () => {
  beforeEach(() => localStorage.clear());

  it('reads every project again from Refresh, saying so while it does', async () => {
    let finish!: () => void;
    const refresh = vi.fn(() => new Promise<'done'>((done) => (finish = () => done('done'))));
    TestBed.overrideProvider(PAGE_REFRESH, { useValue: { refresh } });
    const { fixture, button } = render();
    const refreshButton = button('Refresh');

    refreshButton?.click();
    fixture.detectChanges();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refreshButton?.textContent?.trim()).toBe('Refreshing…');
    expect(refreshButton?.disabled).toBe(true);

    finish();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(refreshButton?.textContent?.trim()).toBe('Refresh');
  });

  it('switches motion from the Motion button and says which way it is', () => {
    const { fixture, button } = render();
    const motion = button('Motion');
    const wasStill = TestBed.inject(MotionPreference).isStill();

    motion?.click();
    fixture.detectChanges();

    expect(TestBed.inject(MotionPreference).isStill()).toBe(!wasStill);
    expect(motion?.textContent?.trim()).toBe(wasStill ? 'Motion on' : 'Motion off');
    expect(motion?.getAttribute('aria-pressed')).toBe(String(wasStill));
  });

  it('sets the star trails’ speed from the Spin lever and shows it', () => {
    const { fixture, element } = render();
    const lever = element.querySelector<HTMLInputElement>('input[aria-label="Star trail speed"]');
    expect(element.querySelector('.spin output')?.textContent).toBe('1×');

    lever!.value = String(TRAIL_SPEEDS.indexOf(25));
    lever!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(TestBed.inject(TrailSpeed).multiplier()).toBe(25);
    expect(element.querySelector('.spin output')?.textContent).toBe('25×');
    expect(lever?.getAttribute('aria-valuetext')).toBe('25×');
  });

  it('says in the lever’s tooltip how busy today is', () => {
    TestBed.overrideProvider(TrailActivity, { useValue: { measured: signal(1.8) } });
    const { element } = render();

    expect(element.querySelector('.spin')?.getAttribute('title')).toContain('1.8× a usual day');
  });

  it('says so when there is no usage to measure today by', () => {
    TestBed.overrideProvider(TrailActivity, { useValue: { measured: signal(null) } });
    const { element } = render();

    expect(element.querySelector('.spin')?.getAttribute('title')).toContain('no Claude Code usage');
  });

  it('ends with ?, which opens help and shows it pressed', () => {
    const { fixture, element } = render();
    const buttons = element.querySelectorAll<HTMLButtonElement>('button');
    const help = buttons[buttons.length - 1];
    expect(help.getAttribute('aria-label')).toBe('Help');

    help.click();
    fixture.detectChanges();

    expect(TestBed.inject(HelpState).isOpen()).toBe(true);
    expect(help.getAttribute('aria-pressed')).toBe('true');
  });
});
