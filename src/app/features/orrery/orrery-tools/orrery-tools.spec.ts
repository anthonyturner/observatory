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
});
