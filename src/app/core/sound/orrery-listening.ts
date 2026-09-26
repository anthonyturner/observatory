import { OrreryWorld, openTotal } from '../orrery/world-layout';
import { severityOf } from '../projects/severity';
import { STEPS_PER_BAR, SystemSound, WorldVoice } from './orrery-score';

/** How far to the sides the widest orbit plays; never hard left or right. */
const MAX_PAN = 0.85;

/** The system as the score hears it at scene time `time`: each world panned
 *  to where its orbit has carried it, innermost first. */
export function systemSoundOf(worlds: readonly OrreryWorld[], time: number): SystemSound {
  const widest = worlds.reduce((most, world) => Math.max(most, world.orbit), 1);
  const voices = [...worlds]
    .sort((a, b) => a.orbit - b.orbit)
    .map((world): WorldVoice => {
      const angle = world.angle + world.speed * time;
      return {
        key: world.project.repo,
        severity: severityOf(world.project).id,
        open: world.project.open,
        rotate: Math.floor((world.spin / (Math.PI * 2)) * STEPS_PER_BAR) % STEPS_PER_BAR,
        pan: Math.cos(angle) * (world.orbit / widest) * MAX_PAN,
      };
    });
  return {
    voices,
    totalOpen: openTotal(worlds),
    blocked: voices.filter((voice) => voice.severity === 'blocked').length,
  };
}
