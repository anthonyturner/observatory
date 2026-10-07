import { clampPercent, hasReset } from './limit-window';

const NOW = Date.parse('2026-10-07T09:00:00Z');
const windowResetting = (resetsAt: string, expired?: boolean) => ({
  pct: 40,
  resetsAt,
  expired,
  points: [],
});

describe('limit window', () => {
  it('holds a percent to what a meter can draw', () => {
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(42)).toBe(42);
    expect(clampPercent(130)).toBe(100);
  });

  it('counts a window as reset once its reset time passes, or when marked expired', () => {
    expect(hasReset(windowResetting('2026-10-07T10:00:00Z'), NOW)).toBe(false);
    expect(hasReset(windowResetting('2026-10-07T09:00:00Z'), NOW)).toBe(true);
    expect(hasReset(windowResetting('2026-10-07T10:00:00Z', true), NOW)).toBe(true);
  });
});
