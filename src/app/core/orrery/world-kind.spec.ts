import { WORLD_KINDS, worldKind } from './world-kind';

describe('worldKind', () => {
  it('gives a repo the same kind on every load', () => {
    expect(worldKind('anthonyturner/observatory')).toBe(worldKind('anthonyturner/observatory'));
  });

  it('uses every kind across a spread of repos', () => {
    const repos = Array.from({ length: 40 }, (_, i) => `owner/repo-${i}`);
    expect(new Set(repos.map(worldKind))).toEqual(new Set(WORLD_KINDS));
  });
});
