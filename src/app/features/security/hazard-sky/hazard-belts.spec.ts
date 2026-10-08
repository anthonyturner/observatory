import {
  SECURITY_NOW,
  securityAlert,
  securityReport,
} from '../../../core/security/testing/security-fixture';
import { Stage } from '../../releases/release-sky/release-path';
import {
  BELT_TILT,
  HAZARD_PX,
  MAX_HAZARDS,
  hazardRadius,
  hazardsOf,
  layoutBelts,
} from './hazard-belts';
import { outlineOf, throbOf, tumbleOf } from './hazard-look';
import { hazardMarks } from './hazard-marks';

const STAGE: Stage = { left: 0, top: 0, width: 1200, height: 600 };

const ALERTS = [
  securityAlert(1, 2, { severity: 'critical', kind: 'secret-scanning' }),
  ...Array.from({ length: 12 }, (_, index) => securityAlert(10 + index, 5, { severity: 'high' })),
  securityAlert(40, 9, { severity: 'low', kind: 'code-scanning' }),
];

describe('hazardsOf', () => {
  it('makes each alert a hazard, in the report’s order', () => {
    const hazards = hazardsOf(securityReport(ALERTS));
    expect(hazards.length).toBe(14);
    expect(hazards[0]).toEqual(
      expect.objectContaining({ key: 'secret-scanning-1', severity: 'critical' }),
    );
  });

  it('makes a visitor’s counts hazards without alerts, worst first', () => {
    const report = { ...securityReport(ALERTS), alerts: [], isWithheld: true };
    const hazards = hazardsOf(report);

    expect(hazards.length).toBe(14);
    expect(hazards.every((hazard) => hazard.alert === null)).toBe(true);
    expect(hazards[0].severity).toBe('critical');
    expect(hazards.at(-1)?.severity).toBe('low');
  });

  it('draws at most MAX_HAZARDS', () => {
    const many = Array.from({ length: MAX_HAZARDS + 5 }, (_, index) => securityAlert(index + 1, 1));
    expect(hazardsOf(securityReport(many)).length).toBe(MAX_HAZARDS);
  });
});

describe('hazardRadius', () => {
  it('grows with the grade and shrinks on a belt’s far side', () => {
    expect(hazardRadius('critical', true)).toBe(HAZARD_PX.critical);
    expect(HAZARD_PX.critical).toBeGreaterThan(HAZARD_PX.high);
    expect(HAZARD_PX.medium).toBeGreaterThan(HAZARD_PX.low);
    expect(hazardRadius('low', false)).toBeLessThan(hazardRadius('low', true));
  });
});

describe('layoutBelts', () => {
  const layout = layoutBelts(hazardsOf(securityReport(ALERTS)), STAGE, 'me/app');

  it('puts the worst grade’s belt innermost, each a tilted ring round the world', () => {
    const widths = layout.belts.map((belt) => belt.radiusX);
    expect(layout.belts.map((belt) => belt.severity)).toEqual([
      'critical',
      'high',
      'medium',
      'low',
    ]);
    expect([...widths].sort((a, b) => a - b)).toEqual(widths);
    expect(widths[0]).toBeGreaterThan(layout.worldRadius);
    expect(layout.belts[0].radiusY).toBeCloseTo(widths[0] * BELT_TILT);
    expect(layout.belts.map((belt) => belt.count)).toEqual([1, 12, 0, 1]);
  });

  it('keeps every hazard on the stage and none out of sight behind the world', () => {
    for (const placed of layout.hazards) {
      expect(placed.x).toBeGreaterThanOrEqual(STAGE.left);
      expect(placed.x).toBeLessThanOrEqual(STAGE.left + STAGE.width);
      expect(placed.y).toBeGreaterThanOrEqual(STAGE.top);
      expect(placed.y).toBeLessThanOrEqual(STAGE.top + STAGE.height);
      const fromCentre = Math.hypot(placed.x - layout.centre.x, placed.y - layout.centre.y);
      if (!placed.isNear) expect(fromCentre).toBeGreaterThan(layout.worldRadius);
    }
  });

  it('places a project’s hazards the same way on every load', () => {
    const again = layoutBelts(hazardsOf(securityReport(ALERTS)), STAGE, 'me/app');
    expect(again.hazards).toEqual(layout.hazards);
  });
});

describe('hazardMarks', () => {
  it('links each alert, most severe first, and nothing for a visitor’s hazards', () => {
    const marks = hazardMarks(
      layoutBelts(hazardsOf(securityReport(ALERTS)), STAGE, 'me/app'),
      SECURITY_NOW,
    );
    expect(marks.length).toBe(14);
    expect(marks[0].url).toBe('https://github.com/me/app/security/dependabot/1');
    expect(marks[0].tip).toBe('Critical · Secret scanning · lodash (npm) · package-lock.json');
    expect(marks[0].spoken).toContain('Secret scanning #1 · opened 2d ago');

    const withheld = { ...securityReport(ALERTS), alerts: [], isWithheld: true };
    const none = hazardMarks(layoutBelts(hazardsOf(withheld), STAGE, 'me/app'), SECURITY_NOW);
    expect(none).toEqual([]);
  });
});

describe('the hazards’ look', () => {
  it('gives each kind its own shape', () => {
    expect(outlineOf('dependabot', 0.3).length).toBe(9);
    expect(outlineOf('code-scanning', 0.3).length).toBe(4);
    expect(outlineOf('secret-scanning', 0.3).length).toBe(8);
  });

  it('turns and throbs only as scene time moves, so motion off holds them still', () => {
    expect(tumbleOf(0, 0.5)).toBe(tumbleOf(0, 0.5));
    expect(tumbleOf(4, 0.5)).not.toBe(tumbleOf(0, 0.5));
    expect(throbOf(1.3, 0.2)).toBeGreaterThanOrEqual(0);
    expect(throbOf(1.3, 0.2)).toBeLessThanOrEqual(1);
  });
});
