import { closestCommandTo, heardWords } from './closest-command';

describe('closestCommandTo', () => {
  it.each<[string, string, boolean]>([
    ['snooze 412 till the cows come home', 'snooze 412 till Monday', true],
    ['snooze four twelve for the release', 'snooze 412 till Monday', true],
    ['dismiss 12 in alpha and beta', 'dismiss 12', true],
    ['snooze', 'snooze 412 till Monday', false],
    ['dismiss', 'dismiss 412', false],
    ['dismiss the PR', 'dismiss 412', false],
    ['um, snoozed the pull request', 'snooze 412 till Monday', false],
  ])('offers %j the command %j', (said, words, isNumberHeard) => {
    expect(closestCommandTo(said)).toEqual({ words, isNumberHeard });
  });

  it('offers nothing for words that are no snooze or dismissal', () => {
    for (const said of [
      'dismiss the banner',
      'how do I dismiss a notification',
      'why did you snooze 412',
      'don’t dismiss 412',
      'what’s blocking',
      'send a crew to 412',
      'snooze and dismiss 12',
      '',
    ]) {
      expect(closestCommandTo(said), said).toBeNull();
    }
  });
});

describe('heardWords', () => {
  it('says what was heard, and the command Jev can do', () => {
    const closest = { words: 'snooze 412 till Monday', isNumberHeard: true };
    expect(heardWords('snooze 412 till the cows come home', closest)).toBe(
      'I heard: “snooze 412 till the cows come home”. Did you mean “snooze 412 till Monday”?',
    );
  });

  it('gives a number heard nowhere as an example only', () => {
    expect(heardWords('dismiss the PR', { words: 'dismiss 412', isNumberHeard: false })).toBe(
      'I heard: “dismiss the PR”. Say it with the pull request’s number, as in “dismiss 412”.',
    );
  });
});
