import { median } from './median';

describe('median', () => {
  it('takes the middle value, whatever the order', () => {
    expect(median([9, 1, 4])).toBe(4);
  });

  it('takes the mean of the middle two when the count is even', () => {
    expect(median([1, 2, 6, 10])).toBe(4);
  });

  it('has none when there are no values', () => {
    expect(median([])).toBeNull();
  });
});
