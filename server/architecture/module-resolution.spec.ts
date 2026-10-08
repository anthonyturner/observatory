import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isProjectModule, resolveModule } from './module-resolution.ts';

const FILES = new Set([
  'src/app/core/clock.ts',
  'src/app/core/index.ts',
  'src/app/ui/face/face.ts',
]);
const ALIASES = [
  { prefix: '@/', target: 'src/' },
  { prefix: '@core/', target: 'src/app/core/' },
];

describe('resolveModule', () => {
  it('follows a relative import to a file or a folder index', () => {
    assert.equal(
      resolveModule('src/app/ui/face/face.ts', '../../core/clock', FILES, []),
      'src/app/core/clock.ts',
    );
    assert.equal(
      resolveModule('src/app/ui/face/face.ts', '../../core', FILES, []),
      'src/app/core/index.ts',
    );
  });

  it('follows an alias, preferring the longest prefix', () => {
    assert.equal(
      resolveModule('src/app/ui/face/face.ts', '@/app/core/clock', FILES, ALIASES),
      'src/app/core/clock.ts',
    );
    assert.equal(
      resolveModule('src/app/ui/face/face.ts', '@core/clock', FILES, ALIASES),
      'src/app/core/clock.ts',
    );
  });

  it('returns null for a package, a missing file or an unscanned one', () => {
    assert.equal(resolveModule('src/app/ui/face/face.ts', '@angular/core', FILES, ALIASES), null);
    assert.equal(resolveModule('src/app/ui/face/face.ts', './missing', FILES, ALIASES), null);
    assert.equal(
      resolveModule('src/app/ui/face/face.ts', '@/environments/env', FILES, ALIASES),
      null,
    );
  });
});

describe('isProjectModule', () => {
  it('tells the project’s own modules from packages', () => {
    assert.equal(isProjectModule('./clock', []), true);
    assert.equal(isProjectModule('@/app/clock', ALIASES), true);
    assert.equal(isProjectModule('@angular/core', ALIASES), false);
  });
});
