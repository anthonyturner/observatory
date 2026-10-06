import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type AreaRule, placeOf } from './area-rules.ts';

const RULES: readonly AreaRule[] = [
  { id: 'clocks', label: 'Clocks', root: 'services/clocks' },
  { id: 'services', label: 'Services', root: 'services' },
  { id: 'shell', label: 'Shell', root: '' },
];

describe('placeOf', () => {
  it('lets the first matching rule win over a wider one that also holds the file', () => {
    assert.equal(placeOf('services/clocks/alarm.ts', RULES)?.area, 'clocks');
    assert.equal(placeOf('services/store.ts', RULES)?.area, 'services');
  });

  it('names the folder below the area root as the group', () => {
    assert.deepEqual(placeOf('services/dials/round/face.ts', RULES), {
      area: 'services',
      group: 'dials',
    });
  });

  it('gives an empty group to a file directly in the area root', () => {
    assert.deepEqual(placeOf('services/store.ts', RULES), { area: 'services', group: '' });
  });

  it('lets an empty root catch every file, grouping by its top folder', () => {
    assert.deepEqual(placeOf('app.ts', RULES), { area: 'shell', group: '' });
    assert.deepEqual(placeOf('misc/thing.ts', RULES), { area: 'shell', group: 'misc' });
  });

  it('does not match a folder that only shares a name prefix with the root', () => {
    assert.equal(placeOf('servicesx/thing.ts', RULES)?.area, 'shell');
  });

  it('returns null when no rule holds the file', () => {
    assert.equal(placeOf('misc/thing.ts', RULES.slice(0, 2)), null);
  });
});
