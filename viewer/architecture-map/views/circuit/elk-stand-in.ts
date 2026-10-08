/** What ELK's worker module exports when it is loaded as a plain script instead of started as a worker. */
interface StandInWorkerModule {
  Worker: new (url?: string) => Worker;
}

/**
 * Runs ELK's worker code on the calling thread, as ELK's own bundled build does.
 * Loading the source with a `module` in scope makes it export a stand-in for a worker
 * instead of starting one. The stand-in has the parts of a worker that ELK uses, not all.
 */
export function standInWorkerFactory(workerSource: string): () => Worker {
  const loaded: { exports: Partial<StandInWorkerModule> } = { exports: {} };
  new Function('module', 'exports', workerSource)(loaded, loaded.exports);
  const StandIn = loaded.exports.Worker;
  if (!StandIn) throw new Error('The layout code did not load.');
  return () => new StandIn() as unknown as Worker;
}
