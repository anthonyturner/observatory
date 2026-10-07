import { groupedNumbersAt, numberAt, wordsOf } from './spoken-numbers';

const read = (said: string) => numberAt(wordsOf(said), 0);
const grouped = (said: string) => groupedNumbersAt(wordsOf(said), 0);

describe('numberAt', () => {
  it.each<[string, number, number]>([
    ['412', 412, 1],
    ['seven', 7, 1],
    ['twelve', 12, 1],
    ['forty two', 42, 2],
    ['twenty-one days', 21, 2],
    ['four hundred', 400, 2],
    ['four hundred twelve', 412, 3],
    ['four hundred and twelve', 412, 4],
    ['twelve hundred', 1200, 2],
    ['twelve hundred and five', 1205, 4],
    ['two thousand', 2000, 2],
    ['one thousand two hundred thirty four', 1234, 6],
    ['nine thousand nine hundred and ninety nine', 9999, 7],
    ['four hundred and then', 400, 2],
  ])('reads %j as %d over %d words', (said, value, length) => {
    expect(read(said)).toEqual({ value, length });
  });

  it('reads no number from other words', () => {
    for (const said of ['', 'hundred', 'the first one', 'oh nine']) {
      expect(read(said), said).toBeNull();
    }
  });
});

describe('groupedNumbersAt', () => {
  it.each<[string, readonly number[]]>([
    ['four twelve', [412]],
    ['four oh nine', [409, 40]],
    ['twelve thirty four', [1234]],
    ['four one two', [412, 41]],
    ['twenty one five', [215]],
    ['4 12', [412]],
    ['four twelve three days', [4123, 412]],
  ])('reads %j as %j, longest first', (said, values) => {
    expect(grouped(said).map((reading) => reading.value)).toEqual(values);
  });

  it('needs two groups, and stops at four digits', () => {
    expect(grouped('twelve')).toEqual([]);
    expect(grouped('oh four')).toEqual([]);
    expect(grouped('412 five')).toEqual([]);
    expect(grouped('twelve thirty four five').map((reading) => reading.value)).toEqual([1234]);
  });
});
