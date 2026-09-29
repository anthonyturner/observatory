import { TestBed } from '@angular/core/testing';
import { AMBIENT_PLAYER } from '../../../core/sound/sound-preference';
import { OrreryTools } from './orrery-tools';

describe('OrreryTools', () => {
  beforeEach(() => localStorage.clear());

  it('turns the ambient score on and off, and says which', async () => {
    const player = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(),
      dispose: vi.fn(),
      setUnease: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AMBIENT_PLAYER, useValue: () => player }],
    });
    const fixture = TestBed.createComponent(OrreryTools);
    fixture.detectChanges();
    const sound = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).find((button) => button.textContent?.includes('Sound'));

    expect(sound?.textContent?.trim()).toBe('Sound off');
    sound?.click();
    fixture.detectChanges();
    expect(sound?.textContent?.trim()).toBe('Sound on');
    expect(sound?.getAttribute('aria-pressed')).toBe('true');
    expect(player.start).toHaveBeenCalled();

    sound?.click();
    expect(player.stop).toHaveBeenCalled();
  });

  function render() {
    const player = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(),
      dispose: vi.fn(),
      setVolume: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AMBIENT_PLAYER, useValue: () => player }],
    });
    const fixture = TestBed.createComponent(OrreryTools);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const button = (words: string) =>
      Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
        b.textContent?.includes(words),
      );
    return { fixture, element, button, player };
  }

  it('asks for a refresh, and holds the button while one runs', () => {
    const { fixture, button } = render();
    let asked = 0;
    fixture.componentInstance.refresh.subscribe(() => asked++);

    button('Refresh')?.click();
    expect(asked).toBe(1);

    fixture.componentRef.setInput('refreshing', true);
    fixture.detectChanges();
    expect(button('Refreshing')?.disabled).toBe(true);
  });

  it('shows a volume slider while the score plays, and sets the volume from it', () => {
    const { fixture, element, button, player } = render();
    expect(element.querySelector('input[type=range]')).toBeNull();

    button('Sound')?.click();
    fixture.detectChanges();
    const slider = element.querySelector<HTMLInputElement>('input[aria-label=Volume]');
    expect(slider?.value).toBe('60');
    slider!.value = '25';
    slider!.dispatchEvent(new Event('input'));

    expect(player.setVolume).toHaveBeenLastCalledWith(0.25);
    expect(localStorage.getItem('observatory.sound.volume')).toBe('0.25');
  });

  it('folds the controls away and remembers it', () => {
    const { fixture, element, button } = render();

    button('Controls')?.click();
    fixture.detectChanges();

    expect(element.hasAttribute('data-folded')).toBe(true);
    expect(button('Controls')?.getAttribute('aria-expanded')).toBe('false');
    expect(localStorage.getItem('observatory.orrery.folded')).toBe('1');
  });
});
