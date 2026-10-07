import { wordsOf } from '../../../core/assistant/spoken-numbers';
import { editDistance } from '../../../shared/text/edit-distance';

/** A project a command can name. */
export interface NamedProject {
  readonly name: string;
  readonly repo: string;
}

/** A request's words less the project they name, and that project: null for none. */
export interface ProjectNamed {
  readonly rest: readonly string[];
  readonly project: NamedProject | null;
}

/** Where the words name a project, and how far what was heard is from its name. */
interface Mention {
  readonly project: NamedProject;
  readonly at: number;
  readonly length: number;
  readonly distance: number;
}

/** What may stand before a project's name: "in observatory". */
const PROJECT_WORDS: ReadonlySet<string> = new Set(['in', 'on', 'for', 'from', 'of', 'project']);
/** A name's letters below which a slip of one would make another word. */
const SHORT_NAME = 5;
const LONG_NAME = 9;

/** How many letters a heard name may be off by: none for a short name,
 *  where one slip makes another word ("beta", "data"). */
const toleranceFor = (letters: number): number =>
  letters < SHORT_NAME ? 0 : letters < LONG_NAME ? 1 : 2;

/** Nearer in letters, then in fewer words, so "for starmap" is not one word misheard. */
const isNearer = (mention: Mention, than: Mention): boolean =>
  mention.distance < than.distance ||
  (mention.distance === than.distance && mention.length < than.length);

/** The closest run of words to `project`'s name, which speech may split or
 *  run together ("star map", "observatry"), or null when none is close. */
function mentionOf(words: readonly string[], project: NamedProject): Mention | null {
  const name = wordsOf(project.name);
  const spelled = name.join('');
  const tolerance = toleranceFor(spelled.length);
  let closest: Mention | null = null;
  for (let at = 0; at < words.length; at++) {
    for (let length = 1; length <= name.length + 1 && at + length <= words.length; length++) {
      const distance = editDistance(words.slice(at, at + length).join(''), spelled);
      const mention = { project, at, length, distance };
      if (distance <= tolerance && (!closest || isNearer(mention, closest))) closest = mention;
    }
  }
  return closest;
}

/** Closer first, then the one that takes more words. */
const byCloseness = (first: Mention, second: Mention): number =>
  first.distance - second.distance || second.length - first.length;

const overlaps = (first: Mention, second: Mention): boolean =>
  first.at < second.at + second.length && second.at < first.at + first.length;

/** Whether `other` names a second project, or fits the same words as well as `named` does. */
const isRival = (other: Mention, named: Mention): boolean =>
  !overlaps(other, named) || byCloseness(other, named) === 0;

/** The words without the project they name and the word before it ("in"),
 *  the project named, or undefined when they name two, or could mean either
 *  of two. Names are matched loosely, as speech-to-text spells them. */
export function withoutProject(
  words: readonly string[],
  projects: readonly NamedProject[],
): ProjectNamed | undefined {
  const [named, ...others] = projects
    .map((project) => mentionOf(words, project))
    .filter((mention) => mention !== null)
    .sort(byCloseness);
  if (!named) return { rest: words, project: null };
  if (others.some((other) => isRival(other, named))) return undefined;
  const before = PROJECT_WORDS.has(words[named.at - 1]) ? named.at - 1 : named.at;
  return {
    rest: [...words.slice(0, before), ...words.slice(named.at + named.length)],
    project: named.project,
  };
}
