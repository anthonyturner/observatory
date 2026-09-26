import { EntryList } from './entry-list';
import { HookRows } from './hook-rows';
import { TranscriptContext } from './transcript-context';
import { ToolRows } from './tool-rows';
import { TranscriptFacts } from './transcript.types';

/** One run's transcript as its readers build it: the entries, and what has
 *  been learned of the run along the way. */
export class TranscriptState implements TranscriptContext {
  readonly list = new EntryList();
  readonly hooks: HookRows;
  readonly tools: ToolRows;
  readonly folder: string;
  private isThinking = false;
  private hasFailed = false;
  private costUsd: number | null = null;
  private readonly warned = new Set<string>();

  constructor(folder: string) {
    this.folder = folder;
    this.hooks = new HookRows(this.list, folder);
    this.tools = new ToolRows(this.list, this.hooks, folder);
  }

  get facts(): TranscriptFacts {
    return {
      isThinking: this.isThinking,
      refused: this.tools.refused,
      lastRefused: this.tools.lastRefused,
      costUsd: this.costUsd,
      hasFailed: this.hasFailed,
    };
  }

  think(isThinking: boolean): void {
    this.isThinking = isThinking;
  }

  conclude(hasFailed: boolean, costUsd: number | null): void {
    this.hasFailed = hasFailed;
    this.costUsd = costUsd;
  }

  hasWarned(key: string): boolean {
    return this.warned.has(key);
  }

  markWarned(key: string): void {
    this.warned.add(key);
  }
}
