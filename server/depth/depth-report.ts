import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { isSource } from '../architecture/project-source.ts';
import { NotFound } from '../http/api-handler.ts';
import { type Git, readOnlyGit } from '../live-agents/read-only-git.ts';
import type { CloneFinder } from '../collisions/clone-finder.ts';
import { PRINCIPLES } from '../principles/principles.ts';
import { keyedCache } from '../util/cached-by-key.ts';
import { mapWithLimit } from '../util/map-with-limit.ts';
import type { DepthModule, DepthPrinciple, DepthReport } from './depth-types.ts';
import { judgeDepth } from './depth-verdict.ts';
import { type ModuleMeasure, measureModule } from './module-measure.ts';
import { type SourceTree, gitSourceTree } from './source-tree.ts';

/** A whole read of a clone costs a few seconds of parsing; a page asks once, a Refresh sooner. */
const REPORT_TTL_MS = 30_000;
const READS_AT_ONCE = 16;
const TEST_HELPER_FOLDER = 'testing';

interface Measured {
  readonly hash: string;
  readonly measure: ModuleMeasure | null;
}

const isCandidate = (path: string): boolean =>
  isSource(path) && !path.split('/').includes(TEST_HELPER_FOLDER);

const hashOf = (text: string): string => createHash('sha1').update(text).digest('hex');

function moduleOf(file: string, measure: ModuleMeasure): DepthModule {
  const folder = posix.dirname(file);
  return { file, folder: folder === '.' ? '' : folder, ...measure, ...judgeDepth(measure) };
}

/**
 * Reads `tree` into modules. A file whose text has not changed since the last
 * read is not parsed again, so reading again after an edit costs one file.
 */
export function depthAnalyser(
  tree: SourceTree,
  measure: typeof measureModule = measureModule,
): () => Promise<DepthModule[]> {
  const known = new Map<string, Measured>();

  async function moduleAt(path: string): Promise<DepthModule | null> {
    const text = await tree.read(path);
    if (text === null) return null;
    const hash = hashOf(text);
    let entry = known.get(path);
    if (entry?.hash !== hash) {
      entry = { hash, measure: measure(path, text) };
      known.set(path, entry);
    }
    return entry.measure && moduleOf(path, entry.measure);
  }

  return async () => {
    const paths = (await tree.files()).filter(isCandidate).sort();
    const modules = await mapWithLimit(paths, READS_AT_ONCE, moduleAt);
    return modules.filter((module) => module !== null);
  };
}

/** The ideas the verdicts name, from the principles the Home card also reads. */
function principlesNamedBy(modules: readonly DepthModule[]): DepthPrinciple[] {
  const named = new Set<string>(modules.map(({ principle }) => principle));
  return PRINCIPLES.filter(({ id }) => named.has(id)).map(({ id, title, idea }) => ({
    id,
    title,
    idea,
  }));
}

/** Depth reports by repository, read from the repository's local clone. */
export interface DepthReports {
  /** Throws NotFound when this machine holds no clone of `repo`. */
  read(repo: string): Promise<DepthReport>;
  /** The next read of `repo` looks at its files again. */
  forget(repo: string): void;
}

export function depthReports(
  clones: CloneFinder,
  git: Git = readOnlyGit(),
  clock: () => number = Date.now,
): DepthReports {
  const analysers = new Map<string, () => Promise<DepthModule[]>>();

  async function analyserOf(repo: string): Promise<() => Promise<DepthModule[]>> {
    const folder = await clones.cloneOf(repo);
    if (folder === null) throw new NotFound(`No local clone of ${repo}.`);
    const key = `${repo}\0${folder}`;
    let analyse = analysers.get(key);
    if (!analyse) {
      analyse = depthAnalyser(gitSourceTree(git, folder));
      analysers.set(key, analyse);
    }
    return analyse;
  }

  const reports = keyedCache(
    async (repo: string): Promise<DepthReport> => {
      const modules = await (await analyserOf(repo))();
      return {
        repo,
        scannedAt: new Date(clock()).toISOString(),
        modules,
        principles: principlesNamedBy(modules),
      };
    },
    REPORT_TTL_MS,
    clock,
  );

  return { read: (repo) => reports.read(repo), forget: (repo) => reports.forget(repo) };
}
