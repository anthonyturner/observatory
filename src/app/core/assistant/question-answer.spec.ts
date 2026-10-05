import { UNREAD_PULL_TITLE, UNREAD_TITLE } from '../activity/activity-watch';
import { OpenItem, OpenKind } from './open-items';
import { QuestionAnswer, answerTo } from './question-answer';

const item = (kind: OpenKind, repo: string, number: number, title: string): OpenItem => ({
  kind,
  repo: `me/${repo}`,
  label: repo,
  number,
  title,
  href: `/p/me/${repo}?${kind === 'pull' ? 'pr' : 'issue'}=${number}`,
});

/** Five items, as the card lists them: every number different, and "login"
 *  in two titles. */
const ITEMS: readonly OpenItem[] = [
  item('pull', 'alpha', 12, 'Dark mode toggle'),
  item('issue', 'beta', 21, 'Crash on login'),
  item('pull', 'gamma', 45, 'Faster login screen'),
  item('issue', 'alpha', 7, UNREAD_TITLE),
  item('pull', 'beta', 99, UNREAD_PULL_TITLE),
];

const opens = (index: number): QuestionAnswer => ({ kind: 'open', item: ITEMS[index] });
const UNMATCHED: QuestionAnswer = { kind: 'unclear', why: 'unmatched' };
const SEVERAL: QuestionAnswer = { kind: 'unclear', why: 'several' };
const ALL: QuestionAnswer = { kind: 'all' };
const NO: QuestionAnswer = { kind: 'no' };

describe('answerTo', () => {
  describe('with five items on the card', () => {
    it.each<[string, QuestionAnswer | null]>([
      ['12', opens(0)],
      ['12.', opens(0)],
      ['#12', opens(0)],
      ['twelve', opens(0)],
      ['Twelve.', opens(0)],
      ['number 12', opens(0)],
      ['Number 12.', opens(0)],
      ['Number twelve!', opens(0)],
      ['No. 12', opens(0)],
      ['pull request 12', opens(0)],
      ['Pull request 12.', opens(0)],
      ['Pull request number 12', opens(0)],
      ['PR 12', opens(0)],
      ['open number 12, please', opens(0)],
      ['issue 21', opens(1)],
      ['Issue twenty-one.', opens(1)],
      ['issue twenty one', opens(1)],
      ['Forty-five', opens(2)],
      ['ninety nine', opens(4)],
      ['99', opens(4)],
      ['seven', opens(3)],
      ['One', UNMATCHED],
      ['first', opens(0)],
      ['The first one.', opens(0)],
      ['the second one', opens(1)],
      ['Third.', opens(2)],
      ['the fourth one', opens(3)],
      ['The fifth one.', opens(4)],
      ['the 2nd one', opens(1)],
      ['The last one.', opens(4)],
      ['last', opens(4)],
      ['the first pull request', opens(0)],
      ['Yes, number 12.', opens(0)],
      ['No, the first one.', opens(0)],
      ['the dark mode one', opens(0)],
      ['Crash.', opens(1)],
      ['the issue', UNMATCHED],
      ['no', NO],
      ['No.', NO],
      ['No thanks.', NO],
      ['no thank you', NO],
      ['nope', NO],
      ['Nope!', NO],
      ['yes', SEVERAL],
      ['Yes.', SEVERAL],
      ['Yes please.', SEVERAL],
      ['yeah', SEVERAL],
      ['All of them.', ALL],
      ['all', ALL],
      ['both', ALL],
      ['open all of them', ALL],
      ['number 13', UNMATCHED],
      ['issue 12', UNMATCHED],
      ['the second pull request', UNMATCHED],
      ['the login one', UNMATCHED],
      ['dark crash', UNMATCHED],
      ['what is the weather', null],
      ['open issues', null],
      ['refresh', null],
      ['stop', null],
      ['remind me in 5 minutes', null],
      ['tell me about pull request 12', null],
      ['one more thing', null],
      ['thanks', null],
      ['um', null],
      ['constructor', null],
      ['', null],
    ])('hears %j as %j', (said, expected) => {
      expect(answerTo(said, ITEMS)).toEqual(expected);
    });
  });

  it('opens the item "one" names when its number is 1', () => {
    const items = [item('issue', 'alpha', 1, 'First issue'), item('pull', 'beta', 2, 'Two')];

    expect(answerTo('One', items)).toEqual({ kind: 'open', item: items[0] });
    expect(answerTo('number one', items)).toEqual({ kind: 'open', item: items[0] });
    expect(answerTo('that one', items)).toBeNull();
  });

  describe('when two repos share a number', () => {
    const items = [
      item('pull', 'alpha', 12, 'Dark mode toggle'),
      item('issue', 'beta', 12, 'Crash on login'),
      item('pull', 'gamma', 12, 'Faster login screen'),
    ];

    it.each<[string, QuestionAnswer]>([
      ['12', UNMATCHED],
      ['number 12', UNMATCHED],
      ['pull request 12', UNMATCHED],
      ['issue 12', { kind: 'open', item: items[1] }],
      ['pull request 12, dark mode', { kind: 'open', item: items[0] }],
    ])('hears %j as %j', (said, expected) => {
      expect(answerTo(said, items)).toEqual(expected);
    });
  });

  describe('with one item on the card', () => {
    const items = [item('pull', 'alpha', 12, 'Dark mode toggle')];

    it.each<[string, QuestionAnswer | null]>([
      ['yes', { kind: 'open', item: items[0] }],
      ['Yeah, sure.', { kind: 'open', item: items[0] }],
      ['the last one', { kind: 'open', item: items[0] }],
      ['the pull request', { kind: 'open', item: items[0] }],
      ['the fifth one', UNMATCHED],
      ['no thanks', NO],
    ])('hears %j as %j', (said, expected) => {
      expect(answerTo(said, items)).toEqual(expected);
    });
  });

  it('never matches a stand-in title, which only says to open the item', () => {
    const items = [item('issue', 'alpha', 7, UNREAD_TITLE), item('issue', 'beta', 8, 'Real bug')];

    expect(answerTo(UNREAD_TITLE, items)).toEqual(UNMATCHED);
  });

  it('hears nothing as an answer with no items to choose from', () => {
    expect(answerTo('12', [])).toBeNull();
    expect(answerTo('yes', [])).toBeNull();
  });
});
