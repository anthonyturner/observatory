import { STILL_TIME } from '../../../core/instrument/frame-loop';
import { flareReach, isOpen, outcomeColour, phaseSeed, pulsePhase, runStarType } from './run-look';

describe('run look', () => {
  it('draws a failure as a flaring giant, a run still going as a bright star', () => {
    expect(runStarType('failed')).toBe('giant');
    expect(runStarType('running')).toBe('bright');
    expect(runStarType('passed')).toBe('calm');
    expect(runStarType('cancelled')).toBe('veiled');
    expect(outcomeColour('failed')).toBe('var(--actions-failed)');
    expect(outcomeColour('skipped')).toBe('var(--actions-cancelled)');
  });

  it('breathes a flare between its size and a third larger, on each star’s own phase', () => {
    const seed = phaseSeed(41);
    const reaches = Array.from({ length: 40 }, (_, step) => flareReach(step * 0.2, seed));

    expect(Math.min(...reaches)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...reaches)).toBeLessThanOrEqual(1.35);
    expect(phaseSeed(41)).not.toBe(phaseSeed(42));
  });

  it('pulses only runs not finished, a queued one slower, and holds at one pose when still', () => {
    expect(isOpen('running')).toBe(true);
    expect(isOpen('queued')).toBe(true);
    expect(isOpen('failed')).toBe(false);
    expect(pulsePhase('running', 1.2, 0)).toBeCloseTo(0.5, 5);
    expect(pulsePhase('queued', 1.2, 0)).toBeCloseTo(0.25, 5);
    expect(pulsePhase('running', STILL_TIME, 0.3)).toBe(pulsePhase('running', STILL_TIME, 0.3));
  });
});
