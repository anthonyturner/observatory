import { TestBed } from '@angular/core/testing';
import { RUN_CACHE_CHARS, RUN_CACHE_STORAGE, RunCache, RunLines } from './run-cache';

class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();
  get length(): number {
    return this.items.size;
  }
  clear(): void {
    this.items.clear();
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

function cacheWith(storage: Storage | null): RunCache {
  TestBed.configureTestingModule({
    providers: [{ provide: RUN_CACHE_STORAGE, useValue: storage }],
  });
  return TestBed.inject(RunCache);
}

describe('RunLines', () => {
  it('keeps each line until they pass the cap, then none at all', () => {
    const lines = new RunLines();
    lines.add('{"n":0}');
    expect(lines.lines).toEqual(['{"n":0}']);

    lines.add('x'.repeat(RUN_CACHE_CHARS));
    expect(lines.lines).toEqual([]);

    lines.add('{"n":2}');
    expect(lines.lines).toEqual([]);
  });
});

describe('RunCache', () => {
  it('gives back the lines kept for the same run, and nothing for another', () => {
    const cache = cacheWith(new MemoryStorage());

    cache.keep('run-1', ['{"n":0}', '{"n":1}']);

    expect(cache.read('run-2')).toBeNull();
    expect(cache.read('run-1')).toEqual(['{"n":0}', '{"n":1}']);
  });

  it('forgets once cleared', () => {
    const cache = cacheWith(new MemoryStorage());
    cache.keep('run-1', ['{"n":0}']);

    cache.clear();

    expect(cache.read('run-1')).toBeNull();
  });

  it('reads nothing from a kept value that is not what it wrote', () => {
    const storage = new MemoryStorage();
    const cache = cacheWith(storage);

    storage.setItem('observatory.run', '{not json');
    expect(cache.read('run-1')).toBeNull();
    storage.setItem('observatory.run', JSON.stringify({ id: 'run-1', lines: 'nope' }));
    expect(cache.read('run-1')).toBeNull();
  });

  it('keeps nothing rather than half when storage refuses, and works with none', () => {
    const storage = new MemoryStorage();
    storage.setItem('observatory.run', JSON.stringify({ id: 'run-1', lines: ['old'] }));
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    const cache = cacheWith(storage);

    cache.keep('run-1', ['new']);
    expect(cache.read('run-1')).toBeNull();

    TestBed.resetTestingModule();
    const none = cacheWith(null);
    none.keep('run-1', ['line']);
    expect(none.read('run-1')).toBeNull();
  });
});
