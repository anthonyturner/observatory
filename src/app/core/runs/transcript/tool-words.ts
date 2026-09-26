import { Json, isObject } from '../../json/json-fields';
import { firstLine } from '../run-words';
import { RowStatus } from './transcript.types';

type ArgReader = (input: Json) => unknown;

const pathIn = (input: Json, key: string): unknown =>
  input['path'] ? `${String(input[key])} in ${String(input['path'])}` : input[key];

/** What a tool's row shows it was called with. Any other tool shows its first
 *  text argument. */
const TOOL_ARG: Readonly<Record<string, ArgReader>> = {
  Bash: (input) => input['command'],
  PowerShell: (input) => input['command'],
  Read: (input) => input['file_path'],
  Write: (input) => input['file_path'],
  Edit: (input) => input['file_path'],
  MultiEdit: (input) => input['file_path'],
  NotebookEdit: (input) => input['notebook_path'],
  Glob: (input) => pathIn(input, 'pattern'),
  Grep: (input) => pathIn(input, 'pattern'),
  WebFetch: (input) => input['url'],
  WebSearch: (input) => input['query'],
  Task: (input) => input['description'],
  Agent: (input) => input['description'],
  TodoWrite: (input) => (Array.isArray(input['todos']) ? `${input['todos'].length} to-dos` : ''),
  Skill: (input) => input['skill'] ?? input['command'],
};

/** What a refused tool was asking to do, for the words under it. */
const TOOL_VERB: Readonly<Record<string, string>> = {
  Bash: 'run',
  PowerShell: 'run',
  Read: 'read',
  Write: 'write',
  Edit: 'edit',
  MultiEdit: 'edit',
  NotebookEdit: 'edit',
  WebFetch: 'fetch',
  WebSearch: 'search for',
};

/** A tool row's mark, and what a screen reader hears for it. */
export const ROW_MARKS: Readonly<
  Record<RowStatus, { readonly mark: string; readonly said: string }>
> = {
  run: { mark: '○', said: 'running' },
  ok: { mark: '✓', said: 'worked' },
  err: { mark: '✕', said: 'failed' },
  refused: { mark: '⊘', said: 'not allowed' },
  skipped: { mark: '⊘', said: 'skipped, as expected' },
  note: { mark: '·', said: '' },
};

const firstText: ArgReader = (input) =>
  Object.values(input).find((value) => typeof value === 'string');

/** A path lower-cased with forward slashes, so Windows and git paths compare. */
export const flatPath = (path: unknown): string =>
  String(path ?? '')
    .toLowerCase()
    .replaceAll('\\', '/');

/** The one line a tool's row shows. A path inside the run's own folder reads
 *  shorter without the folder. */
export function toolArg(name: string, input: Json, folder: string): string {
  const line = firstLine((TOOL_ARG[name] ?? firstText)(input));
  const home = flatPath(folder);
  return home && flatPath(line).startsWith(`${home}/`) ? line.slice(home.length + 1) : line;
}

export const toolVerb = (name: string): string => TOOL_VERB[name] ?? 'use';

const MCP_NAME = /^mcp__(.+?)__(.+)$/;

/** "server · tool" for an MCP tool; any other tool's own name. */
export function toolTitle(name: string): string {
  const mcp = MCP_NAME.exec(name);
  return mcp ? `${mcp[1]} · ${mcp[2]}` : name;
}

/** A message's content as text: its text parts, and a marker for each other part. */
export function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(partText).join('\n');
  return content === null || content === undefined ? '' : JSON.stringify(content, null, 2);
}

function partText(part: unknown): string {
  const fields: Json = isObject(part) ? part : {};
  if (fields['type'] === 'text') return String(fields['text'] ?? '');
  return `[${typeof fields['type'] === 'string' ? fields['type'] : 'part'}]`;
}
