import { fieldOf, isNumber, isObject, isText, listOf, oneOf } from '../json/json-fields';
import { AgentChanges, AgentChangesState, ChangesProblem } from './agent-changes.types';

const PROBLEMS: readonly ChangesProblem[] = [
  'no-folder',
  'folder-gone',
  'not-a-repo',
  'no-base',
  'git-failed',
  'timed-out',
];
const isProblem = oneOf(PROBLEMS);

const textOrNull = (value: unknown): string | null => (isText(value) ? value : null);
const textOrEmpty = (value: unknown): string => (typeof value === 'string' ? value : '');
const countOf = (value: unknown): number => (isNumber(value) && value > 0 ? value : 0);

/** The diff, or null without the folder and base it was read against. */
function parseDiff(value: Record<string, unknown>): AgentChanges | null {
  const folder = fieldOf(value, 'folder', isText);
  const base = fieldOf(value, 'base', isText);
  if (!folder || !base) return null;
  return {
    folder,
    readFrom: fieldOf(value, 'readFrom', isText) ?? folder,
    branch: textOrNull(value['branch']),
    base,
    repo: textOrNull(value['repo']),
    isCommittedOnly: value['isCommittedOnly'] === true,
    isSharedCheckout: value['isSharedCheckout'] === true,
    diff: textOrEmpty(value['diff']),
    diffBytes: countOf(value['diffBytes']),
    diffTruncated: value['diffTruncated'] === true,
    skippedLarge: listOf(value['skippedLarge'], textOrNull),
    untrackedOverCap: countOf(value['untrackedOverCap']),
  };
}

/** The state `GET /api/live-agents/changes` answers with, or null when the body is not that answer. */
export function parseAgentChanges(body: unknown): AgentChangesState | null {
  const changes = isObject(body) ? body['changes'] : undefined;
  if (!isObject(changes)) return null;
  if (changes['kind'] === 'problem') {
    const problem = fieldOf(changes, 'problem', isProblem);
    return problem ? { status: 'problem', problem } : null;
  }
  const diff = changes['kind'] === 'diff' ? parseDiff(changes) : null;
  return diff ? { status: 'ready', changes: diff } : null;
}
