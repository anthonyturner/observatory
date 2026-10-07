import { commandWordsOf } from './command-words';

const read = (said: string): string => commandWordsOf(said).join(' ');

describe('commandWordsOf', () => {
  it.each<[string, string]>([
    ['Dismiss PR 412', 'dismiss pr 412'],
    ['dismiss P.R. 412', 'dismiss pr 412'],
    ['dismiss p r 412', 'dismiss pr 412'],
    ['dismiss PR412', 'dismiss pr 412'],
    ['dismiss pull request 412', 'dismiss pr 412'],
    ['what pull requests are blocked', 'what pr are blocked'],
    ['open the PRs', 'open the pr'],
  ])('reads a pull request however it is written: %j', (said, words) => {
    expect(read(said)).toBe(words);
  });

  it.each<[string, string]>([
    ['um, snooze 412', 'snooze 412'],
    ['uh dismiss 412', 'dismiss 412'],
    ['so, what’s blocking', "what's blocking"],
    ['Hey Jev, dismiss 412', 'dismiss 412'],
    ['Jeff, dismiss 412', 'dismiss 412'],
    ['Jeb dismiss 412', 'dismiss 412'],
    ['can you dismiss 412 please', 'dismiss 412'],
    ['I want to snooze 412', 'snooze 412'],
    ['I’d like to snooze 412', 'snooze 412'],
    ['go ahead and dismiss 412, thank you', 'dismiss 412'],
  ])('drops fillers and wake words: %j', (said, words) => {
    expect(read(said)).toBe(words);
  });

  it.each<[string, string]>([
    ['snoozed 412', 'snooze 412'],
    ['snoose 412', 'snooze 412'],
    ['snoozing 412', 'snooze 412'],
    ['dismissed 412', 'dismiss 412'],
    ['dis-miss 412', 'dismiss 412'],
  ])('puts a command word in one form: %j', (said, words) => {
    expect(read(said)).toBe(words);
  });

  it.each<[string, string]>([
    ['send a through to 412', 'send a crew to 412'],
    ['send through to 412', 'send crew to 412'],
    ['assign a true member', 'assign a crew member'],
    ['dispatch the cru', 'dispatch the crew'],
    ['snooze 412 tell Monday', 'snooze 412 till monday'],
    ['snooze 412 tell next week', 'snooze 412 till next week'],
  ])('hears a misheard command word where the words round it show it: %j', (said, words) => {
    expect(read(said)).toBe(words);
  });

  it.each<string>([
    'go through 412',
    'send it through to review',
    'send through the changes',
    'is that true',
    'get through the queue',
    'tell me what’s blocking',
    'tell monday about it',
    'snooze 412 and tell me',
  ])('leaves a sound-alike as it is elsewhere: %j', (said) => {
    expect(commandWordsOf(said)).not.toContain('crew');
    expect(commandWordsOf(said)).not.toContain('till');
  });
});
