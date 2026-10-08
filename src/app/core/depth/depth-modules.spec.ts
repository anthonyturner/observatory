import { modulesMatching, shallowestFirst, verdictCounts } from './depth-modules';
import { depthModule } from './testing/depth-fixture';

const DEEP = depthModule('server/queue/pull-queue.ts', 120, 4);
const BALANCED = depthModule('src/app/core/queue/queue-feed.ts', 20, 8);
const SHALLOW = depthModule('src/app/core/queue/index.ts', 0, 6);
const MODULES = [DEEP, BALANCED, SHALLOW];

describe('modulesMatching', () => {
  it('keeps everything for an empty filter', () => {
    expect(modulesMatching(MODULES, { query: '  ', verdict: null })).toEqual(MODULES);
  });

  it('wants every word in the path, in any case and any order', () => {
    expect(modulesMatching(MODULES, { query: 'QUEUE core', verdict: null })).toEqual([
      BALANCED,
      SHALLOW,
    ]);
  });

  it('keeps only the verdict asked for', () => {
    expect(modulesMatching(MODULES, { query: 'queue', verdict: 'shallow' })).toEqual([SHALLOW]);
  });
});

describe('verdictCounts', () => {
  it('counts each verdict, naming those with none', () => {
    expect(verdictCounts([DEEP, SHALLOW, SHALLOW])).toEqual({ deep: 1, balanced: 0, shallow: 2 });
  });
});

describe('shallowestFirst', () => {
  it('puts the least deep first and does not reorder its input', () => {
    expect(shallowestFirst(MODULES)).toEqual([SHALLOW, BALANCED, DEEP]);
    expect(MODULES[0]).toBe(DEEP);
  });

  it('puts the wider interface first among equals', () => {
    const narrow = depthModule('a.ts', 0, 2);
    const wide = depthModule('b.ts', 0, 9);

    expect(shallowestFirst([narrow, wide])).toEqual([wide, narrow]);
  });
});
