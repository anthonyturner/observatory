import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type AreaRule, placeOf } from './area-rules.ts';

const RULES: readonly AreaRule[] = [
  { id: 'clocks', label: 'Clocks', root: 'src/app/services/clocks' },
  { id: 'services', label: 'Services', root: 'src/app/services' },
  { id: 'shell', label: 'Shell', root: 'src/app' },
];

describe('placeOf', () => {
  it('lets the first matching rule win over a wider one that also holds the file', () => {
    assert.equal(placeOf('src/app/services/clocks/alarm.ts', RULES)?.area, 'clocks');
    assert.equal(placeOf('src/app/services/store.ts', RULES)?.area, 'services');
  });

  it('names the folder below the area root as the group', () => {
    assert.deepEqual(placeOf('src/app/services/dials/round/face.ts', RULES), {
      area: 'services',
      group: 'dials',
    });
  });

  it('gives an empty group to a file directly in the area root', () => {
    assert.deepEqual(placeOf('src/app/services/store.ts', RULES), { area: 'services', group: '' });
  });

  it('lets the app root catch every file, grouping by its top folder', () => {
    assert.deepEqual(placeOf('src/app/app.ts', RULES), { area: 'shell', group: '' });
    assert.deepEqual(placeOf('src/app/misc/thing.ts', RULES), { area: 'shell', group: 'misc' });
  });

  it('does not match a folder that only shares a name prefix with the root', () => {
    assert.equal(placeOf('src/app/servicesx/thing.ts', RULES)?.area, 'shell');
  });

  it('returns null when no rule holds the file', () => {
    assert.equal(placeOf('src/app/misc/thing.ts', RULES.slice(0, 2)), null);
  });
});
