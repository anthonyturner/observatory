import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CoreGeometry } from '../../../core/instrument/core-geometry';
import { CORE_STATE } from '../../../core/instrument/core-tokens';
import { Lens } from '../../../core/instrument/lens';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { VoiceLevel } from '../../../core/voice/voice-level';

/** The ring sits at half the core's radius, and grows by up to this much with the voice. */
const RING_OF_CORE = 0.5;
const LEVEL_GROWTH = 0.45;
/** Room round the ring for its stroke and the sweeping dot. */
const PAD_PX = 6;
/** The sweep's fading tail, in steps, each this many radians long. */
const TAIL_STEPS = 6;
const TAIL_STEP_RAD = 0.14;

type RingKind = 'level' | 'sweep';

/** The voice ring round the core's centre: its size follows the mic while
 *  listening, and a dot sweeps round it while speech turns into words. Still,
 *  it holds its size, dashed while transcribing. HTML over the core, so it is
 *  the same in 3D and 2D and adds nothing to the scene. Ported from pr-starmap. */
@Component({
  selector: 'app-voice-ring',
  templateUrl: './voice-ring.html',
  styleUrl: './voice-ring.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.still]': 'motion.isStill()' },
})
export class VoiceRing {
  protected readonly motion = inject(MotionPreference);
  private readonly geometry = inject(CoreGeometry);
  private readonly state = inject(CORE_STATE);
  private readonly voice = inject(VoiceLevel);

  protected readonly kind = computed((): RingKind | null => {
    const state = this.state();
    if (state === 'listening') return 'level';
    return state === 'transcribing' ? 'sweep' : null;
  });

  /** Where the core's centre is, and the ring's radius, or null when there is no ring. */
  protected readonly ring = computed(() => {
    const kind = this.kind();
    const view = this.geometry.view();
    if (!kind || !view || view.isAway) return null;
    const lens = new Lens();
    lens.aim(view);
    const centre = lens.project(0, 0, 0);
    const grows = kind === 'level' && !this.motion.isStill();
    const radius = view.radius * RING_OF_CORE * (grows ? 1 + LEVEL_GROWTH * this.voice.level() : 1);
    const size = Math.ceil((radius + PAD_PX) * 2);
    return { kind, x: centre.x - size / 2, y: centre.y - size / 2, size, radius };
  });

  /** The sweep's tail: arcs behind the dot, each fainter, as stroke dashes. */
  protected readonly tail = computed(() => {
    const ring = this.ring();
    if (!ring) return [];
    const circumference = Math.PI * 2 * ring.radius;
    const step = TAIL_STEP_RAD * ring.radius;
    return Array.from({ length: TAIL_STEPS }, (_, k) => ({
      dash: `${step} ${circumference - step}`,
      // Each one further behind the dot as it turns clockwise.
      offset: step * (k + 1),
      opacity: 0.9 * (1 - k / TAIL_STEPS),
    }));
  });
}
