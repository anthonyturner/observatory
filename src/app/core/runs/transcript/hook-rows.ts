import { Json } from '../../json/json-fields';
import { firstLine } from '../run-words';
import { EntryList } from './entry-list';
import { flatPath } from './tool-words';
import { HookLine, NewEntry } from './transcript.types';

/** How much of a hook's output is searched for the folder it named. */
const SEARCHED_CHARS = 20000;
/** How much of a hook's first line its row quotes. */
const QUOTED_CHARS = 90;
/** A folder must be this deep to count as named: "/c" alone names nothing. */
const MIN_NAMED_DEPTH = 2;

interface Hook {
  readonly id: unknown;
  readonly name: string;
  readonly event: string;
  outcome: string | null;
  output: string;
  /** Its output, flattened as paths are, for `thatNamed`. */
  searchable: string;
}

/** The hooks shown in one Hooks row. */
interface HookGroup {
  readonly key: number;
  readonly hooks: Hook[];
}

function outcomeOf(data: Json): string {
  if (typeof data['outcome'] === 'string' && data['outcome']) return data['outcome'];
  return data['exit_code'] === 0 ? 'success' : `exit ${String(data['exit_code'])}`;
}

function lineOf(hook: Hook): HookLine {
  const first = firstLine(hook.output);
  const quote = first
    ? ` · “${first.slice(0, QUOTED_CHARS)}${first.length > QUOTED_CHARS ? '…' : ''}”`
    : '';
  return { name: hook.name, said: ` · ${hook.outcome ?? 'running'}${quote}` };
}

function groupEntry(group: HookGroup): NewEntry {
  const waiting = group.hooks.filter((hook) => !hook.outcome).length;
  return {
    kind: 'fold',
    name: 'Hooks',
    arg: `${group.hooks.length} ran${waiting ? `, ${waiting} still running` : ''}`,
    status: 'note',
    isPlain: true,
    isNested: false,
    refusal: null,
    detail: [{ kind: 'hooks', title: 'Your Claude Code hooks', hooks: group.hooks.map(lineOf) }],
  };
}

/**
 * The owner's Claude Code hooks. Hooks that run one after another fold into
 * one row; opening it lists each, with how it went. A hook that fails reads
 * the same way, quietly: it is the owner's own, not the task's.
 */
export class HookRows {
  private readonly hooks: Hook[] = [];
  private group: HookGroup | null = null;

  private readonly list: EntryList;
  private readonly folder: string;

  constructor(list: EntryList, folder: string) {
    this.list = list;
    this.folder = folder;
  }

  read(data: Json): void {
    const group = this.currentGroup();
    const hook = this.hookFor(data, group);
    const output = String(data['output'] || data['stdout'] || '');
    if (output) {
      hook.output = output;
      hook.searchable = flatPath(output).slice(0, SEARCHED_CHARS);
    }
    if (data['subtype'] === 'hook_response') hook.outcome = outcomeOf(data);
    this.list.replace(group.key, groupEntry(group));
  }

  /**
   * The event of the hook, if any, whose own words named the folder a refused
   * tool was aimed at: a hook that asks Claude to write a file of its own is
   * refused in a run from Home, and that refusal is expected, not the task's.
   * A path in the run's own folder is always the task's.
   */
  thatNamed(input: Json): string | null {
    const path = input['file_path'] ?? input['notebook_path'] ?? input['path'];
    if (typeof path !== 'string') return null;
    const folder = flatPath(path).replace(/\/[^/]*$/, '');
    const home = flatPath(this.folder);
    if (home && (folder === home || folder.startsWith(`${home}/`))) return null;
    const needles = [folder, folder.startsWith('~/') ? folder.slice(1) : ''].filter(
      (needle) => needle.split('/').filter(Boolean).length >= MIN_NAMED_DEPTH,
    );
    const hook = this.hooks.find((each) =>
      needles.some((needle) => each.searchable.includes(needle)),
    );
    return hook ? hook.event || 'Claude Code' : null;
  }

  /** The group the last row is, or a new one. */
  private currentGroup(): HookGroup {
    if (this.group && this.list.lastKey === this.group.key) return this.group;
    const hooks: Hook[] = [];
    this.group = { key: this.list.add(groupEntry({ key: -1, hooks })), hooks };
    return this.group;
  }

  private hookFor(data: Json, group: HookGroup): Hook {
    const known = this.hooks.find((hook) => hook.id === data['hook_id']);
    if (known) return known;
    const hook: Hook = {
      id: data['hook_id'],
      name: String(data['hook_name'] ?? data['hook_event'] ?? 'hook'),
      event: String(data['hook_event'] ?? ''),
      outcome: null,
      output: '',
      searchable: '',
    };
    this.hooks.push(hook);
    group.hooks.push(hook);
    return hook;
  }
}
