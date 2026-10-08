import ELK from 'elkjs/lib/elk-api.js';
import workerSource from 'elkjs/lib/elk-worker.min.js' with { type: 'text' };
import type { ElkRunner } from './board-layout.ts';
import { standInWorkerFactory } from './elk-stand-in.ts';

class WorkerFailed extends Error {}

/** A real background thread, started from the worker code inlined in this page. */
function backgroundWorker(onFailure: (error: WorkerFailed) => void): () => Worker {
  const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  return () => {
    const worker = new Worker(url);
    worker.addEventListener('error', () =>
      onFailure(new WorkerFailed('The layout worker stopped.')),
    );
    return worker;
  };
}

/**
 * Runs ELK off the page's thread, so a large board does not freeze the page while it is laid out.
 * Where the browser will not start the inlined worker, as some do for a file opened from disk,
 * the layout runs on the page's thread instead, slower to respond but the same result.
 */
export function createElkRunner(): ElkRunner {
  let reportFailure: (error: WorkerFailed) => void = () => undefined;
  let elk: InstanceType<typeof ELK> | null = null;
  let onPageThread = false;

  const start = (): InstanceType<typeof ELK> => {
    try {
      return new ELK({ workerFactory: backgroundWorker((error) => reportFailure(error)) });
    } catch (error) {
      // A browser that refuses to start the worker is expected here, so the layout falls back to the page's thread.
      console.warn('Laying the board out on the page thread:', error);
      onPageThread = true;
      return new ELK({ workerFactory: standInWorkerFactory(workerSource) });
    }
  };

  return async (graph) => {
    elk ??= start();
    if (onPageThread) return elk.layout(graph);
    const failed = new Promise<never>((_, reject) => {
      reportFailure = reject;
    });
    try {
      return await Promise.race([elk.layout(graph), failed]);
    } catch (error) {
      if (!(error instanceof WorkerFailed)) throw error;
      console.warn('Laying the board out on the page thread:', error);
      onPageThread = true;
      elk.terminateWorker();
      elk = new ELK({ workerFactory: standInWorkerFactory(workerSource) });
      return elk.layout(graph);
    }
  };
}
