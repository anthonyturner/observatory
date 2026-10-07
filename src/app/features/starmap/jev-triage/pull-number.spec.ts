import { wordsOf } from '../../../core/assistant/spoken-numbers';
import { pullNumbersAt, withNumbersInDigits } from './pull-number';

describe('pullNumbersAt', () => {
  it.each<[string, readonly number[]]>([
    ['412', [412]],
    ['four twelve', [412, 4]],
    ['four hundred and twelve', [412]],
    ['twelve thirty four', [1234, 12]],
    ['twenty one', [21]],
    ['four twelve two weeks', [4122, 412, 4]],
    ['the first one', []],
  ])('reads %j as %j, longest first', (said, values) => {
    expect(pullNumbersAt(wordsOf(said), 0).map((reading) => reading.value)).toEqual(values);
  });
});

describe('withNumbersInDigits', () => {
  it.each<[string, string]>([
    ['four twelve in alpha', '412 in alpha'],
    ['four hundred and twelve', '412'],
    ['twenty one', '21'],
    ['the first one', 'the first one'],
    ['number two', 'number two'],
    ['412', '412'],
  ])('writes %j as %j', (said, words) => {
    expect(withNumbersInDigits(wordsOf(said)).join(' ')).toBe(words);
  });
});
