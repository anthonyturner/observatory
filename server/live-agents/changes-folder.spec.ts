import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { workPlaceOf } from './changes-folder.ts';

const line = (cwd: string | undefined, gitBranch?: string): string =>
  JSON.stringify({ type: 'user', cwd, gitBranch });

describe('workPlaceOf', () => {
  it('takes the latest folder on a feature branch, past a later step onto main', () => {
    const lines = [
      line('E:\\repos\\app', 'main'),
      line('E:\\repos\\app-wt-7', 'feat/7-thing'),
      line('E:\\repos\\app', 'main'),
    ];

    assert.deepEqual(workPlaceOf(lines), { cwd: 'E:\\repos\\app-wt-7', branch: 'feat/7-thing' });
  });

  it('takes the latest folder of all when none is on a feature branch', () => {
    const lines = [line('E:\\repos\\app', 'main'), line('C:\\Users\\me'), '{ cut short'];

    assert.deepEqual(workPlaceOf(lines), { cwd: 'C:\\Users\\me', branch: null });
  });

  it('finds nothing when no line names a folder', () => {
    assert.equal(workPlaceOf([line(undefined), 'not json']), null);
  });
});
