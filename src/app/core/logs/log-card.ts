import { formatAt, formatCount, windowName } from './log-format';
import { logColour } from './log-levels';
import { LogStar } from './log-layout';
import { LogFault, LogSnapshot, LogWindow } from './log-snapshot';
import { isTwin } from './log-trace';

/** One fact on the card: `first  Sep 23, 01:43 AM`. */
export interface LogFact {
  readonly term: string;
  readonly value: string;
  /** Lit in the star's colour: a fault still burning. */
  readonly isHot: boolean;
}

/** What a log star's card shows. */
export interface LogCardView {
  /** Its colour as CSS, for the card's edge and kicker. */
  readonly colour: string;
  /** `Error — desktop`, in the serif above the number. */
  readonly kicker: string;
  /** `×1,204`, or a quiet window's name. */
  readonly title: string;
  /** A quiet window's one line. */
  readonly heading: string | null;
  /** A fault's scrubbed message. */
  readonly excerpt: string | null;
  readonly facts: readonly LogFact[];
  /** What Copy message copies; a quiet window has nothing to copy. */
  readonly message: string | null;
  /** A GitHub code search for the message, when it has a phrase worth finding. */
  readonly findUrl: string | null;
}

const fact = (term: string, value: string, isHot = false): LogFact => ({ term, value, isHot });
/** A shorter phrase matches too much code to be worth searching for. */
const MIN_PHRASE = 9;
const MAX_PHRASE = 80;
const PHRASE_BREAKS = /[#…{}'"|]/;

/** The card for a star: a fault's message and where else it fired, or a quiet
 *  window's lines. `repo` names the repository Find in code searches. */
export function logCardView(
  star: LogStar,
  snapshot: LogSnapshot,
  repo: string | null,
  locale?: string,
): LogCardView | null {
  if (star.fault) return faultCard(star, star.fault, { snapshot, repo, locale });
  return star.win ? quietCard(star.win, locale) : null;
}

function quietCard(window: LogWindow, locale?: string): LogCardView {
  const when = (at: string | null) => (at ? formatAt(at, locale) : '—');
  return {
    colour: logColour('quiet'),
    kicker: 'Quiet window',
    title: windowName(window.id),
    heading: `No errors or warnings in ${formatCount(window.lines, locale)} lines.`,
    excerpt: null,
    facts: [
      fact('sessions', formatCount(window.sessions, locale)),
      fact('first', when(window.firstAt)),
      fact('last', when(window.lastAt)),
    ],
    message: null,
    findUrl: null,
  };
}

interface CardContext {
  readonly snapshot: LogSnapshot;
  readonly repo: string | null;
  readonly locale?: string;
}

function faultCard(star: LogStar, fault: LogFault, context: CardContext): LogCardView {
  const { locale } = context;
  const twins = context.snapshot.faults.filter((other) => isTwin(other, fault));
  const facts = [
    ...(fault.service ? [fact('service', fault.service)] : []),
    fact('active', `${fault.activeDays} ${fault.activeDays === 1 ? 'day' : 'days'}`),
    fact('first', formatAt(fault.firstAt, locale)),
    fact(
      'last',
      `${formatAt(fault.lastAt, locale)}${star.urgent ? ' · still burning' : ''}`,
      star.urgent,
    ),
    fact(
      'also in',
      twins.length
        ? twins
            .map((twin) => `${windowName(twin.window)} ×${formatCount(twin.count, locale)}`)
            .join(', ')
        : 'this window only',
    ),
  ];
  return {
    colour: logColour(fault.level),
    kicker: `${fault.level === 'error' ? 'Error' : 'Warning'} — ${windowName(fault.window)}`,
    title: `×${formatCount(fault.count, locale)}`,
    heading: null,
    excerpt: fault.text,
    facts,
    message: fault.text,
    findUrl: findInCodeUrl(fault.text, context.repo),
  };
}

/** A GitHub code search for the longest literal run of `text`: it survives
 *  the scrubbing of numbers and payloads, so it is the phrase most likely to
 *  match the source that logged it. */
export function findInCodeUrl(text: string, repo: string | null): string | null {
  const [phrase] = text
    .split(PHRASE_BREAKS)
    .map((part) => part.trim())
    .sort((a, b) => b.length - a.length);
  if (!repo || !phrase || phrase.length < MIN_PHRASE) return null;
  const query = `repo:${repo} "${phrase.slice(0, MAX_PHRASE)}"`;
  return `https://github.com/search?type=code&q=${encodeURIComponent(query)}`;
}
