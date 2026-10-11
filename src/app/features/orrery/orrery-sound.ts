import { DOCUMENT, Injectable, Provider, computed, inject, signal } from '@angular/core';
import { layoutWorlds } from '../../core/orrery/world-layout';
import { MotionPreference } from '../../core/motion/motion-preference';
import { PROJECTS } from '../../core/projects/projects-source';
import { OrrerySynth } from '../../core/sound/orrery-synth';
import { systemSoundOf } from '../../core/sound/orrery-listening';
import { ArrivalCue } from '../../core/sound/orrery-score';
import { AMBIENT_PLAYER, SoundPreference } from '../../core/sound/sound-preference';

/** The world picked on the Orrery, by hover or by click. The page and its
 *  score both read it: the score plays the picked world's motif. */
@Injectable()
export class OrreryFocus {
  readonly selected = signal<string | null>(null);
}

/** The most merges held for the score; a burst beyond this is a crowd, not cues. */
const MAX_HELD_CUES = 6;

/** The merges the Orrery has marked, until the score takes them. The canvas puts
 *  one in as its speck sets off; the score plays it once. */
@Injectable()
export class OrreryCues {
  private held: ArrivalCue[] = [];

  push(cue: ArrivalCue): void {
    this.held = [...this.held, cue].slice(-MAX_HELD_CUES);
  }

  take(): readonly ArrivalCue[] {
    const taken = this.held;
    this.held = [];
    return taken;
  }
}

/** The Orrery's own Sound: pr-starmap's orrery score, for this page only. */
export function provideOrrerySound(): Provider[] {
  return [
    OrreryFocus,
    OrreryCues,
    SoundPreference,
    {
      provide: AMBIENT_PLAYER,
      useFactory: () => {
        const projects = inject(PROJECTS);
        const focus = inject(OrreryFocus);
        const cues = inject(OrreryCues);
        const motion = inject(MotionPreference);
        const document = inject(DOCUMENT);
        const worlds = computed(() => layoutWorlds(projects()));
        const bornAt = performance.now();
        // The worlds turn on the page's own clock; with motion off they hold.
        const sceneTime = (): number =>
          motion.isStill() ? 0 : (performance.now() - bornAt) / 1000;
        return () =>
          new OrrerySynth({
            system: () => systemSoundOf(worlds(), sceneTime()),
            picked: () => focus.selected(),
            isHidden: () => document.hidden,
            arrivals: () => cues.take(),
          });
      },
    },
  ];
}
