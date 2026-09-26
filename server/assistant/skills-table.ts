import { MAX_REQUEST_LENGTH } from './route-contract.ts';

/** One tile on Home: `prompt` is exactly what Claude Code is asked, in the
 *  project's checkout; `project`, when set, pins it to the project of that name. */
export interface Skill {
  readonly label: string;
  readonly description: string;
  readonly prompt: string;
  readonly project?: string;
}

export type SkillTable = Readonly<Record<string, Skill>>;

/** Where the skill table comes from; read afresh on each call, so an edited
 *  skills.json needs no restart. */
export type SkillSource = () => Promise<SkillTable>;

/**
 * The starters. Every one only reads, and names the read-only `gh` commands
 * it uses, so the owner can allow exactly those. "Change nothing" is an
 * instruction to the model, not a lock: the owner's allow rules are the lock.
 */
export const SKILLS: SkillTable = {
  queue: {
    label: 'Triage the review queue',
    description: 'The blocked-first queue of open pull requests, with what to do first.',
    prompt:
      'Rank the open pull requests in this repository blocked first: merge conflicts, then failing checks, then mergeability GitHub has not worked out yet, then no linked issue, then waiting on a review. For each, give its number, title and what blocks it, and say which one to act on first and why. Read GitHub only with gh pr list and gh pr view (their --json fields carry mergeability, checks, reviews and linked issues). Change nothing.',
  },
  blocked: {
    label: 'Summarise what’s blocked',
    description: 'Each open pull request that cannot merge yet, why, and the smallest next step.',
    prompt:
      'List the open pull requests in this repository that cannot merge yet: merge conflicts, failing or pending checks, changes requested, or no linked issue. For each, give its number and title, say in one line what is blocking it, and name the smallest next step to unblock it. Read GitHub only with gh pr list and gh pr view (their --json fields carry mergeability, checks, reviews and linked issues). Change nothing.',
  },
  stale: {
    label: 'Find stale PRs',
    description: 'Open pull requests with no activity for a week or more.',
    prompt:
      'Find the open pull requests in this repository with no activity for 7 days or more. For each, give its number, title, author and days idle, and say whether it waits on a review, waits on its author, or looks abandoned. Oldest first. Read GitHub only with gh pr list and gh pr view. Change nothing.',
  },
  failures: {
    label: 'Explain today’s failures',
    description: 'Why the checks that failed in the last 24 hours failed.',
    prompt:
      'Look at the workflow runs in this repository that failed in the last 24 hours. For each distinct failure, say which branch or pull request it belongs to and explain the likely cause in plain words. If nothing failed, say so. Read GitHub only with gh run list, gh run view --log-failed and gh pr list. Change nothing.',
  },
};

const SKILL_ID = /^[a-z][a-z0-9-]{0,39}$/;
const MAX_LABEL = 40;
const MAX_DESCRIPTION = 160;
const MAX_PROJECT = 200;
/** The whole table, starters included: past this the tiles stop being a
 *  shortcut, and the list is sent to the page on every load. */
export const MAX_SKILLS = 24;

type Json = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `value` trimmed, when it is text of at least one and at most `max` characters. */
function textOf(value: unknown, max: number): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= max ? text : null;
}

/** A description too long for a tooltip is cut rather than lost. */
function descriptionOf(value: unknown): string {
  const said = typeof value === 'string' ? value.trim() : '';
  return said.length > MAX_DESCRIPTION ? `${said.slice(0, MAX_DESCRIPTION - 1)}…` : said;
}

/** One skill as given, checked and trimmed, or null when it is not one. */
function skillOf(given: unknown): Skill | null {
  if (!isObject(given)) return null;
  const label = textOf(given['label'], MAX_LABEL);
  const prompt = textOf(given['prompt'], MAX_REQUEST_LENGTH);
  if (!label || !prompt) return null;
  const project = textOf(given['project'], MAX_PROJECT);
  return {
    label,
    description: descriptionOf(given['description']),
    prompt,
    ...(project ? { project } : {}),
  };
}

/**
 * The starters with the owner's own over them: an entry under a starter's id
 * replaces it in place, `null` removes it, and a new id is added after the
 * starters, up to MAX_SKILLS in all. An entry that is not a skill, or whose id
 * is not lower-case words joined by dashes, is left out, and `warn` gets one
 * line naming it. The table has no prototype, so no id can reach an inherited
 * property.
 */
export function skillTable(extra: unknown, warn: (line: string) => void): SkillTable {
  const table: Record<string, Skill> = Object.assign(Object.create(null), SKILLS);
  if (!isObject(extra)) {
    warn('skills.json: expected an object of skills by id, so only the starter skills show');
    return table;
  }
  const invalid: string[] = [];
  const overLimit: string[] = [];
  for (const [id, given] of Object.entries(extra)) {
    const skill = skillOf(given);
    if (!SKILL_ID.test(id) || (given !== null && !skill)) invalid.push(id);
    else if (!skill) delete table[id];
    else if (!Object.hasOwn(table, id) && Object.keys(table).length >= MAX_SKILLS)
      overLimit.push(id);
    else table[id] = skill;
  }
  if (invalid.length) {
    warn(
      `skills.json: left out ${invalid.join(', ')}: each needs a lower-case id with dashes, a label of up to ${MAX_LABEL} characters and a prompt`,
    );
  }
  if (overLimit.length) {
    warn(`skills.json: at most ${MAX_SKILLS} skills in all, so left out ${overLimit.join(', ')}`);
  }
  return table;
}
