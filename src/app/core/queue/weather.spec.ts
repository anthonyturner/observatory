import { flagWeight, parseWeatherReport } from './weather';

const answer = {
  repo: 'me/app',
  hidden: false,
  pulls: [
    {
      number: 7,
      headSha: 'abc',
      scanned: true,
      flags: [
        {
          kind: 'swallowed-error',
          path: 'src/a.ts',
          line: 12,
          note: 'empty catch',
          excerpt: '} catch {}',
        },
        { kind: 'untracked-todo', path: 'src/a.ts', line: 20, note: 'TODO with no issue' },
        { kind: 'weather-machine', path: 'src/a.ts', line: 30 },
      ],
    },
    { number: 8, headSha: 'def', scanned: false, flags: [] },
    { number: 'nine' },
  ],
};

describe('parseWeatherReport', () => {
  it('reads each pull request and its flags, dropping what is not in shape', () => {
    const report = parseWeatherReport(answer);

    expect(report?.repo).toBe('me/app');
    expect(report?.pulls.map((pull) => pull.number)).toEqual([7, 8]);
    expect(report?.pulls[0].flags.map((flag) => `${flag.kind}@${flag.line}`)).toEqual([
      'swallowed-error@12',
      'untracked-todo@20',
    ]);
    expect(report?.pulls[0].flags[1].excerpt).toBe('');
    expect(report?.pulls[1].scanned).toBe(false);
  });

  it('is no answer without a repository or a list of pull requests', () => {
    expect(parseWeatherReport(null)).toBeNull();
    expect(parseWeatherReport({ repo: 'me/app' })).toBeNull();
    expect(parseWeatherReport({ pulls: [] })).toBeNull();
  });
});

describe('flagWeight', () => {
  it('adds up each flag by how grave it is, and counts nothing not scanned', () => {
    const report = parseWeatherReport(answer);
    expect(flagWeight(report?.pulls[0])).toBe(4);
    expect(flagWeight(report?.pulls[1])).toBe(0);
    expect(flagWeight(undefined)).toBe(0);
  });
});
