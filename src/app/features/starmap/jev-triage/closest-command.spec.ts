import { closestCommandTo, heardWords } from './closest-command';

describe('closestCommandTo', () => {
  it.each<[string, string]>([
    ['snooze 412 till the cows come home', 'snooze 412 till Monday'],
    ['snooze four twelve for the release', 'snooze 412 till Monday'],
    ['snooze', 'snooze 412 till Monday'],
    ['dismiss', 'dismiss 412'],
    ['dismiss the PR', 'dismiss 412'],
    ['um, snoozed the pull request', 'snooze 412 till Monday'],
  ])('offers %j the command %j', (said, closest) => {
    expect(closestCommandTo(said)).toBe(closest);
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
  it('says what was heard, and what Jev can do', () => {
    expect(heardWords('snooze 412 till the cows come home', 'snooze 412 till Monday')).toBe(
      'I heard: “snooze 412 till the cows come home”. Did you mean “snooze 412 till Monday”?',
    );
  });
});
