import { editDistance } from './edit-distance';

describe('editDistance', () => {
  it.each<[string, string, number]>([
    ['', '', 0],
    ['alpha', 'alpha', 0],
    ['', 'abc', 3],
    ['abc', '', 3],
    ['observatory', 'observatry', 1],
    ['starmap', 'starmaps', 1],
    ['kitten', 'sitting', 3],
  ])('counts %j to %j as %d', (from, to, distance) => {
    expect(editDistance(from, to)).toBe(distance);
    expect(editDistance(to, from)).toBe(distance);
  });
});
