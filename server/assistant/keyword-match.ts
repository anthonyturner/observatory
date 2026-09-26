import { ACTABLE_IDS, ACTIONS, type ActableId } from './actions.ts';
import type { Project } from './route-contract.ts';

/**
 * Words a command may carry around its keywords and still be a command. A
 * request is matched by keyword only when every word in it is one of these,
 * an action's keyword or a project's name: "open the logs for observatory"
 * matches, "how do I stop a rebase" does not, although it says "stop".
 */
const FILLER = new Set([
  'a', 'again', 'all', 'an', 'and', 'at', 'back', 'be', 'bring', 'can', 'check', 'could', 'data', 'display',
  'everything', 'for', 'from', 'github', 'go', 'goto', 'hey', 'i', 'in', 'it', 'jev', 'just', 'let', 'me', 'my',
  'need', 'now', 'of', 'ok', 'okay', 'on', 'open', 'our', 'page', 'please', 'project', 'projects', 'repo',
  'repository', 'screen', 'see', 'show', 'speaking', 'take', 'talking', 'tab', 'that', 'the', 'there', 'this',
  'to', 'up', 'view', 'want', 'would', 'you',
]); // prettier-ignore

/** The action a request means when it names only a project. */
const BARE: ActableId = 'open-star-map';

/** What a request names: `action` is set only when it is a command and nothing more. */
export interface KeywordMatch {
  readonly action: ActableId | null;
  /** Every action whose keywords it uses. */
  readonly actions: readonly ActableId[];
  readonly project: Project | null;
}

/** Lower case, possessives dropped, split on anything that is not a letter or digit. */
export const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .replace(/[’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

interface Keyword<T> {
  readonly value: T;
  readonly sequence: readonly string[];
}

const longestFirst = <T>(keywords: Keyword<T>[]): Keyword<T>[] =>
  keywords
    .filter((each) => each.sequence.length)
    .sort((a, b) => b.sequence.length - a.sequence.length);

const KEYWORDS = longestFirst(
  ACTABLE_IDS.flatMap((id) => {
    const { words: said = [], heard = [] } = ACTIONS[id];
    return [...said, ...heard].map((word) => ({ value: id, sequence: words(word) }));
  }),
);

/** A request's words, each of which one keyword at most may claim. */
class Tokens {
  private readonly all: readonly string[];
  private readonly claimed: boolean[];

  constructor(all: readonly string[]) {
    this.all = all;
    this.claimed = all.map(() => false);
  }

  /** Where `sequence` first appears among the words still free, or -1. */
  find(sequence: readonly string[]): number {
    for (let at = 0; at + sequence.length <= this.all.length; at++) {
      if (sequence.every((word, k) => !this.claimed[at + k] && this.all[at + k] === word))
        return at;
    }
    return -1;
  }

  claim(at: number, length: number): void {
    this.claimed.fill(true, at, at + length);
  }

  /** The words no keyword claimed that are not filler either. */
  leftover(): string[] {
    return this.all.filter((word, at) => !this.claimed[at] && !FILLER.has(word));
  }
}

/** The project a request names, by name or repository. Projects are matched
 *  first, longest name first, so a project called "logs-api" is a project and
 *  not a request for logs. */
function namedProject(tokens: Tokens, projects: readonly Project[]) {
  const names = longestFirst(
    projects.flatMap((project) =>
      [project.name, project.repo].map((name) => ({ value: project, sequence: words(name) })),
    ),
  );
  let project: Project | null = null;
  let isAmbiguous = false;
  for (const { value, sequence } of names) {
    const at = tokens.find(sequence);
    if (at < 0) continue;
    if (project && project !== value) {
      isAmbiguous = true;
      continue;
    }
    project = value;
    tokens.claim(at, sequence.length);
  }
  return { project, isAmbiguous };
}

function namedActions(tokens: Tokens): Set<ActableId> {
  const found = new Set<ActableId>();
  for (const { value, sequence } of KEYWORDS) {
    for (let at = tokens.find(sequence); at >= 0; at = tokens.find(sequence)) {
      found.add(value);
      tokens.claim(at, sequence.length);
    }
  }
  return found;
}

/** The project a request names and the actions whose keywords it uses. It is
 *  a command only when exactly one action is named and nothing is left but filler. */
export function keywordMatch(text: string, projects: readonly Project[]): KeywordMatch {
  const tokens = new Tokens(words(text));
  const { project, isAmbiguous } = namedProject(tokens, projects);
  const found = namedActions(tokens);
  // A request that names only a project ("open observatory") means its star map.
  if (!found.size && project && !isAmbiguous) found.add(BARE);
  const actions = [...found];
  const isExact = actions.length === 1 && !tokens.leftover().length && !isAmbiguous;
  return {
    action: isExact ? actions[0] : null,
    actions,
    project: isAmbiguous ? null : project,
  };
}
