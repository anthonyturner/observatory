import { OpenItem } from '../../../core/assistant/open-items';
import { ASK_NUMBER, CrewPick, crewPickOf, crewReferenceOf, whichWords } from './crew-request';
import { pullItemOf } from './queue-top';

const observatory = { name: 'observatory', repo: 'me/observatory' };
const starmap = { name: 'starmap', repo: 'me/starmap' };

/** The blocking list, as Jev read it out. */
const LISTED: readonly OpenItem[] = [
  pullItemOf(starmap, 3, 'Playlist sync'),
  pullItemOf(observatory, 486, 'Play the playlist video'),
  pullItemOf(observatory, 488, 'Floating usage strip'),
];
const OPEN: readonly OpenItem[] = [
  ...LISTED,
  pullItemOf(observatory, 412, 'Fix login'),
  pullItemOf(starmap, 412, 'Starmap login'),
  pullItemOf(starmap, 9, null),
];

const one = (pull: OpenItem): CrewPick => ({ kind: 'one', pull });

describe('crewReferenceOf', () => {
  it.each<[string, string | null]>([
    ['send a crew to 412', '412'],
    ['Send a crew to number 412.', 'number 412'],
    ['assign it to a crew member', 'it'],
    [
      'the observatory one about the playlist, assign it to a crew member',
      'the observatory one about the playlist it',
    ],
    ['get a crew on it', 'it'],
    ['Jev, could you send crew to the first one please', 'the first one'],
    ['have a crew fix 412 in starmap', '412 in starmap'],
    ['what did the crew do', null],
    ['send it to me', null],
    ['what’s blocking?', null],
  ])('reads %j as %j', (said, expected) => {
    expect(crewReferenceOf(said)).toBe(expected);
  });
});

describe('crewPickOf', () => {
  describe('after the blocking list', () => {
    it.each<[string, CrewPick | null]>([
      ['486', one(LISTED[1])],
      ['the first one', one(LISTED[0])],
      ['number two', one(LISTED[1])],
      ['the third', one(LISTED[2])],
      ['the last one', one(LISTED[2])],
      ['the observatory one about the playlist', one(LISTED[1])],
      ['the usage strip one', one(LISTED[2])],
      ['the starmap one', one(LISTED[0])],
      ['the observatory one', { kind: 'which', pulls: [LISTED[1], LISTED[2]] }],
      ['the playlist one', { kind: 'which', pulls: [LISTED[0], LISTED[1]] }],
      ['', { kind: 'which', pulls: LISTED }],
      ['412 in observatory', one(OPEN[3])],
      ['412', { kind: 'which', pulls: [OPEN[3], OPEN[4]] }],
      ['number 999', { kind: 'unmatched', listed: LISTED }],
      ['the fourth one', { kind: 'unmatched', listed: LISTED }],
      ['number five', { kind: 'unmatched', listed: LISTED }],
      ['the flux capacitor', null],
    ])('picks %j as %j', (reference, expected) => {
      expect(crewPickOf(reference, LISTED, OPEN)).toEqual(expected);
    });
  });

  describe('with no list', () => {
    it.each<[string, CrewPick | null]>([
      ['412 in starmap', one(OPEN[4])],
      ['9', one(OPEN[5])],
      ['412', { kind: 'which', pulls: [OPEN[3], OPEN[4]] }],
      ['', { kind: 'number' }],
      ['number 999', { kind: 'number' }],
      ['number nine', one(OPEN[5])],
      ['the first one', null],
      ['the flux capacitor', null],
    ])('picks %j as %j', (reference, expected) => {
      expect(crewPickOf(reference, [], OPEN)).toEqual(expected);
    });
  });
});

describe('whichWords', () => {
  it('names the candidates', () => {
    expect(whichWords({ kind: 'which', pulls: [OPEN[3], OPEN[4], OPEN[5]] })).toBe(
      'Which one: observatory pull request 412 (“Fix login”), starmap pull request 412 (“Starmap login”) or starmap pull request 9?',
    );
  });

  it('names the list when nothing on it fits', () => {
    expect(whichWords({ kind: 'unmatched', listed: LISTED.slice(0, 2) })).toBe(
      'I can’t tell which one that is. Is it starmap pull request 3 (“Playlist sync”) or observatory pull request 486 (“Play the playlist video”)?',
    );
  });

  it('asks for a number when there are too many to name', () => {
    expect(whichWords({ kind: 'number' })).toBe(ASK_NUMBER);
  });
});
