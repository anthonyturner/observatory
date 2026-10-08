import { parseDepthReport } from './depth-parse';

const MODULE = {
  file: 'src/a.ts',
  folder: 'src',
  implementation: 12,
  interfaceSize: 3,
  depth: 4,
  verdict: 'balanced',
  principle: 'deep-modules',
};
const PRINCIPLE = { id: 'deep-modules', title: 'Make modules deep', idea: 'Hide a lot.' };
const REPORT = {
  repo: 'me/app',
  scannedAt: '2026-10-08T12:00:00.000Z',
  modules: [MODULE],
  principles: [PRINCIPLE],
};

describe('parseDepthReport', () => {
  it('reads a report, the scan time as milliseconds', () => {
    expect(parseDepthReport(REPORT)).toEqual({
      repo: 'me/app',
      scannedAt: Date.parse('2026-10-08T12:00:00.000Z'),
      modules: [MODULE],
      principles: [PRINCIPLE],
    });
  });

  it('keeps a module at the repository root, whose folder is empty', () => {
    const report = parseDepthReport({ ...REPORT, modules: [{ ...MODULE, folder: '' }] });

    expect(report?.modules[0].folder).toBe('');
  });

  it('drops a module with a field missing or odd rather than guessing at it', () => {
    const report = parseDepthReport({
      ...REPORT,
      modules: [
        MODULE,
        { ...MODULE, verdict: 'excellent' },
        { ...MODULE, implementation: 'lots' },
        { ...MODULE, file: '' },
        null,
      ],
    });

    expect(report?.modules).toEqual([MODULE]);
  });

  it('drops a module whose sizes are not counts: a negative one would break the layout', () => {
    const report = parseDepthReport({
      ...REPORT,
      modules: [
        MODULE,
        { ...MODULE, file: 'negative.ts', implementation: -1 },
        { ...MODULE, file: 'fraction.ts', interfaceSize: 2.5 },
        { ...MODULE, file: 'depth.ts', depth: -3 },
      ],
    });

    expect(report?.modules.map(({ file }) => file)).toEqual(['src/a.ts']);
  });

  it('is nothing when the body is not a report', () => {
    for (const body of [
      null,
      'text',
      [],
      {},
      { ...REPORT, modules: 'none' },
      { ...REPORT, scannedAt: 'soon' },
    ]) {
      expect(parseDepthReport(body)).toBeNull();
    }
  });
});
