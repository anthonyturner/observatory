import type { JevQuestions } from './open-router.ts';
import type { Project } from './route-contract.ts';

/** What each tier means to Jev. The keys are its answer. */
export const TIERS = {
  tier1:
    'One of the listed app actions: open a page, show a list, refresh, stop speaking. Nothing to think about.',
  tier2:
    'A question answered in a few sentences from general knowledge. No files, no tools, no changes.',
  web: 'A question that needs current information from the internet: news, recent events, new releases, prices, anything that changes. Answered from a web search.',
  tier3:
    'Work in a project: read or change code or files, run commands, handle pull requests or issues, or anything with several steps.',
} as const;

export type Tier = keyof typeof TIERS;

/** What the page carries out itself. */
export type PageOp = 'refresh' | 'help' | 'stop';

/** `says` is what Jev reads; `words` match without Jev; `heard` are what Home's
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

/** Jev's answer when no action is meant. */
const NO_ACTION = 'none';

/** Tier-1 actions. The keyword matcher and the questions Jev reads are both
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

const NO_ACTION_SAYS = 'None of these';
/** Jev's answer when no project is meant. */
const NO_PROJECT = 'none';

export const isActable = (id: unknown): id is ActableId =>
  typeof id === 'string' && Object.hasOwn(ACTIONS, id);

export const ACTABLE_IDS = Object.keys(ACTIONS) as ActableId[];

/** The questions Jev is asked about one request: which tier, which action,
 *  and, when there are any, which project. */
export function questionsFor(projects: readonly Project[]): JevQuestions {
  const questions: Record<string, JevQuestions[string]> = {
    tier: {
      type: 'choice',
      instructions: "How much effort does this request to a developer's dashboard need?",
      criteria: TIERS,
    },
    action: {
      type: 'choice',
      instructions: 'If it asks for one of these app actions, which one?',
      criteria: {
        ...Object.fromEntries(ACTABLE_IDS.map((id) => [id, ACTIONS[id].says])),
        [NO_ACTION]: NO_ACTION_SAYS,
      },
    },
  };
  if (projects.length) questions['project'] = projectQuestion(projects);
  return questions;
}

function projectQuestion(projects: readonly Project[]): JevQuestions[string] {
  return {
    type: 'choice',
    instructions: 'Which of these projects does the request name or mean?',
    criteria: {
      ...Object.fromEntries(
        projects.map((project) => [project.name, `The project ${project.name} (${project.repo})`]),
      ),
      [NO_PROJECT]: 'No project is named or meant',
    },
  };
}
