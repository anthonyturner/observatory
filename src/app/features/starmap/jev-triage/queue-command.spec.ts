import { NamedProject, confirmationOf, queueCommandOf } from './queue-command';

const ALPHA: NamedProject = { name: 'alpha', repo: 'me/alpha' };
const STARMAP: NamedProject = { name: 'pr-starmap', repo: 'me/pr-starmap' };
const WEDNESDAY = new Date(2026, 9, 7, 10, 0);

const commandOf = (said: string) => queueCommandOf(said, [ALPHA, STARMAP], WEDNESDAY);

describe('queueCommandOf', () => {
  it('hears “what’s blocking?” however it is put', () => {
    for (const said of [
      'What’s blocking?',
      "what's blocked",
      'Jev, what is stuck right now',
      'blocking',
    ]) {
      expect(commandOf(said)).toEqual({ kind: 'blocking', project: null });
    }
  });

  it('hears next star, next PR and next pull request', () => {
    for (const said of [
      'Next star',
      'open the next PR',
      'Take me to the next pull request, please',
    ]) {
      expect(commandOf(said)).toEqual({ kind: 'next', project: null });
    }
  });

  it('scopes a command to the project it names', () => {
    expect(commandOf('what’s blocking in alpha')).toEqual({ kind: 'blocking', project: ALPHA });
    expect(commandOf('next star for pr-starmap')).toEqual({ kind: 'next', project: STARMAP });
  });

  it('hears a snooze with its pull request and its time', () => {
    expect(commandOf('Snooze 412 till Monday.')).toEqual({
      kind: 'snooze',
      pr: 412,
      until: { days: 5, words: 'till Monday' },
      project: null,
    });
    expect(commandOf('snooze PR #12 in alpha for 3 days')).toEqual({
      kind: 'snooze',
      pr: 12,
      until: { days: 3, words: 'for 3 days' },
      project: ALPHA,
    });
  });

  it('snoozes for a week when no time is named', () => {
    expect(commandOf('snooze twelve')).toEqual(
      expect.objectContaining({ pr: 12, until: { days: 7, words: 'for a week' } }),
    );
  });

  it('hears a dismissal, the number however it is said', () => {
    for (const said of ['Dismiss 412', 'please dismiss pull request 412', 'dismiss number 412']) {
      expect(commandOf(said)).toEqual({ kind: 'dismiss', pr: 412, project: null });
    }
  });

  it('leaves anything more than a plain command to Jev', () => {
    for (const said of [
      'why is the build blocked by the linter',
      'what is the next star in the sky',
      'next steps',
      'snooze',
      'snooze 412 till the cows come home',
      'dismiss 412 because it is stale',
      'dismiss the banner',
      'what’s blocking in alpha and pr-starmap',
    ]) {
      expect(commandOf(said), said).toBeNull();
    }
  });
});

describe('confirmationOf', () => {
  it('hears yes', () => {
    for (const said of ['Yes', 'yeah, do it', 'OK', 'go ahead please', 'confirm']) {
      expect(confirmationOf(said)).toBe('yes');
    }
  });

  it('hears no', () => {
    for (const said of ['No', 'no thanks', 'nope', 'cancel', 'never mind', 'don’t']) {
      expect(confirmationOf(said)).toBe('no');
    }
  });

  it('is neither for both, or for a request of its own', () => {
    for (const said of ['yes no', 'what’s blocking', 'yes, and open the orrery', '']) {
      expect(confirmationOf(said)).toBeNull();
    }
  });
});
