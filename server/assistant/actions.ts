/** What the page carries out itself. */
export type PageOp = 'refresh' | 'help' | 'stop';

/** `says` is how Jev's tools describe it; `words` match without Jev; `heard` are what Home's
 *  speech model writes for a word it mishears, matched but never shown to Jev. */
interface Spoken {
  readonly says: string;
  readonly words?: readonly string[];
  readonly heard?: readonly string[];
}

export interface PageAction extends Spoken {
  readonly op: PageOp;
}

/** A page at one address; `title` is how a reply names it. */
export interface FixedPlace extends Spoken {
  readonly title: string;
  readonly href: string;
}

/** A part of a project's star map: one project's (`project`), or any one's,
 *  when the part is the same on each (`any`). */
export interface ProjectPart extends Spoken {
  readonly title: string;
  readonly needs: 'project' | 'any';
  readonly part: string;
}

export type Action = PageAction | FixedPlace | ProjectPart;

export type ActableId =
  | 'open-orrery'
  | 'open-home'
  | 'open-star-map'
  | 'show-issues'
  | 'show-logs'
  | 'show-usage'
  | 'refresh'
  | 'help'
  | 'stop';

/** Tier-1 actions. The keyword matcher and Jev's open_page tool are both
 *  built from this table, so a new action is one entry and both learn it. */
export const ACTIONS: Readonly<Record<ActableId, Action>> = {
  // Whisper base writes "orrery", a rare word, as "ory" or "ori".
  'open-orrery': {
    says: 'Open the orrery, the view of every project',
    words: ['orrery', 'all projects'],
    heard: ['ory', 'ori'],
    title: 'the orrery',
    href: '/orrery',
  },
  'open-home': { says: 'Go back to Home', words: ['home'], title: 'Home', href: '/' },
  'open-star-map': {
    says: "Open one project's star map of pull requests",
    words: ['star map', 'pull requests', 'pull request', 'prs'],
    title: 'Pull requests',
    needs: 'project',
    part: '',
  },
  'show-issues': {
    says: "Show one project's issues",
    words: ['issues', 'issue'],
    title: 'Issues',
    needs: 'project',
    part: '#issues',
  },
  'show-logs': {
    says: "Show one project's log sky",
    words: ['logs', 'log sky', 'log'],
    title: 'Logs',
    needs: 'project',
    part: '#logs',
  },
  'show-usage': {
    says: 'Show Claude Code usage',
    words: ['usage', 'limits'],
    title: 'Usage',
    needs: 'any',
    part: '#usage',
  },
  refresh: { says: 'Refresh the data from GitHub now', words: ['refresh'], op: 'refresh' },
  help: { says: 'Explain what is on this page', words: ['help'], op: 'help' },
  stop: { says: 'Stop talking', words: ['stop', 'quiet'], op: 'stop' },
};

export const isActable = (id: unknown): id is ActableId =>
  typeof id === 'string' && Object.hasOwn(ACTIONS, id);

export const ACTABLE_IDS = Object.keys(ACTIONS) as ActableId[];
