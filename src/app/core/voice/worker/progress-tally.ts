import { LoadProgress } from './transformers-api';

export type ProgressReport = (loaded: number, total: number) => void;

interface FileBytes {
  readonly loaded: number;
  readonly total: number;
}

/** Adds up the bytes of every file a load fetches, reporting the sum. */
export class ProgressTally {
  private readonly files = new Map<string, FileBytes>();

  constructor(private readonly report: ProgressReport) {}

  add(progress: LoadProgress): void {
    if (progress.status !== 'progress' || !progress.file) return;
    this.files.set(progress.file, { loaded: progress.loaded ?? 0, total: progress.total ?? 0 });
    let loaded = 0;
    let total = 0;
    for (const file of this.files.values()) {
      loaded += file.loaded;
      total += file.total;
    }
    this.report(loaded, total);
  }
}
