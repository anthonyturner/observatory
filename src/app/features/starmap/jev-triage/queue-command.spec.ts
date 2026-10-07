import { NamedProject } from './project-mention';
import { QueueCommand, confirmationOf, queueCommandOf } from './queue-command';

const ALPHA: NamedProject = { name: 'alpha', repo: 'me/alpha' };
const STARMAP: NamedProject = { name: 'pr-starmap', repo: 'me/pr-starmap' };
const WEDNESDAY = new Date(2026, 9, 7, 10, 0);

const commandOf = (said: string) => queueCommandOf(said, [ALPHA, STARMAP], WEDNESDAY);

const dismiss = (pr: number, project: NamedProject | null = null): QueueCommand => ({
  kind: 'dismiss',
  pr,
  project,
});
const snooze = (pr: number, days: number, words: string): QueueCommand => ({
  kind: 'snooze',
  pr,
  until: { days, words },
  project: null,
});
const TILL_MONDAY = snooze(412, 5, 'till Monday');

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

  it.each<[string, QueueCommand]>([
    ['dismiss four twelve', dismiss(412)],
    ['dismiss four hundred and twelve', dismiss(412)],
    ['dismiss twelve thirty four', dismiss(1234)],
    ['dismiss nine thousand nine hundred and ninety nine', dismiss(9999)],
    ['dismiss P.R. 412', dismiss(412)],
    ['dismiss p r 412', dismiss(412)],
    ['dismiss PR412', dismiss(412)],
    ['dismiss pull requests 412', dismiss(412)],
    ['um, dismiss 412', dismiss(412)],
    ['uh dismiss 412', dismiss(412)],
    ['so dismiss 412', dismiss(412)],
    ['hey Jev, dismiss 412', dismiss(412)],
    ['Jeff dismiss 412', dismiss(412)],
    ['Jeb, dismiss 412', dismiss(412)],
    ['can you dismiss 412', dismiss(412)],
    ['please dismiss 412', dismiss(412)],
    ['dismissed 412', dismiss(412)],
    ['I want to snooze 412 till Monday', TILL_MONDAY],
    ['snoozed 412 till Monday', TILL_MONDAY],
    ['snoose 412 till Monday', TILL_MONDAY],
    ['snooze 412 tell Monday', TILL_MONDAY],
    ['um snooze four twelve till Monday please', TILL_MONDAY],
    ['snooze four twelve two weeks', snooze(412, 14, 'for 2 weeks')],
    ['go ahead and dismiss 412 because it is stale', dismiss(412)],
    ['snooze 412 because it is stale', snooze(412, 7, 'for a week')],
    ['snooze 412, it can wait till Monday', TILL_MONDAY],
    ['dismiss 412 in alpa', dismiss(412, ALPHA)],
    ['dismiss 412 in the starmap', dismiss(412, STARMAP)],
  ])('forgives how %j is said', (said, command) => {
    expect(commandOf(said)).toEqual(command);
  });

  it('leaves anything more than a plain command to Jev', () => {
    for (const said of [
      'why is the build blocked by the linter',
      'what is the next star in the sky',
      'next steps',
      'snooze',
      'snooze 412 till the cows come home',
      'dismiss the banner',
      'why did you dismiss 412',
      'don’t snooze 412',
      'snooze and dismiss 412',
      'go through 412',
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
