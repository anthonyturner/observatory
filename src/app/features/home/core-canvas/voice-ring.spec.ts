import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CoreGeometry } from '../../../core/instrument/core-geometry';
import { CoreStateId } from '../../../core/instrument/core-states';
import { CORE_STATE } from '../../../core/instrument/core-tokens';
import { coreViewOf } from '../../../core/instrument/core-view';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { VoiceLevel } from '../../../core/voice/voice-level';
import { VoiceRing } from './voice-ring';

function render(state: CoreStateId, level = 0, isStill = false) {
  const levelNow = signal(level);
  TestBed.configureTestingModule({
    providers: [
      { provide: CORE_STATE, useValue: signal(state) },
      { provide: VoiceLevel, useValue: { level: levelNow } },
      { provide: MotionPreference, useValue: { isStill: signal(isStill) } },
    ],
  });
  TestBed.inject(CoreGeometry).place(
    coreViewOf(
      { left: 400, top: 100, width: 400, height: 400 },
      { width: 1200, height: 800, scrollY: 0, pixelRatio: 1 },
    ),
  );
  const fixture = TestBed.createComponent(VoiceRing);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const radius = (): number => Number(element.querySelector('.line')?.getAttribute('r'));
  return { fixture, element, levelNow, radius };
}

describe('VoiceRing', () => {
  it('shows nothing while the core is idle', () => {
    expect(render('idle').element.querySelector('svg')).toBeNull();
  });

  it('grows with the mic while listening', () => {
    const { fixture, levelNow, radius, element } = render('listening');
    const quiet = radius();

    levelNow.set(1);
    fixture.detectChanges();

    expect(radius()).toBeCloseTo(quiet * 1.45);
    expect(element.querySelector('.spinner')).toBeNull();
  });

  it('holds its size while listening with motion off', () => {
    const { fixture, levelNow, radius } = render('listening', 0, true);
    const quiet = radius();

    levelNow.set(1);
    fixture.detectChanges();

    expect(radius()).toBe(quiet);
  });

  it('sweeps a dot with a fading tail round the ring while transcribing', () => {
    const { element } = render('transcribing');

    expect(element.querySelector('svg.sweep .spinner .dot')).not.toBeNull();
    const tail = Array.from(element.querySelectorAll('.tail')).map((arc) =>
      Number(arc.getAttribute('opacity')),
    );
    expect(tail.length).toBe(6);
    expect(tail[0]).toBeGreaterThan(tail[5]);
  });
});
