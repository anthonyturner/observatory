import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { workPlaceOf } from './changes-folder.ts';

const line = (cwd: string | undefined, gitBranch?: string): string =>
  JSON.stringify({ type: 'user', cwd, gitBranch });

const wrote = (cwd: string, filePath: string): string =>
  JSON.stringify({
    type: 'assistant',
    cwd,
    gitBranch: 'main',
    message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: filePath } }] },
  });

/** Each folder under `/repos/` is a working tree. */
const rootOf = (path: string): string | null => /^\/repos\/[^/]+/.exec(path)?.[0] ?? null;

describe('workPlaceOf', () => {
  it('takes the latest folder on a feature branch, past a later step onto main', () => {
    const lines = [
      line('/repos/app', 'main'),
      line('/repos/app-wt-7', 'feat/7-thing'),
      line('/repos/app', 'main'),
    ];

    assert.deepEqual(workPlaceOf(lines, rootOf), {
      cwd: '/repos/app-wt-7',
      branch: 'feat/7-thing',
    });
  });

  it('takes the worktree an agent standing on main last wrote a file in', () => {
    const lines = [wrote('/repos/app', '/repos/app-12/src/a.ts'), line('/repos/app', 'main')];

    assert.deepEqual(workPlaceOf(lines, rootOf), { cwd: '/repos/app-12', branch: null });
  });

  it('stays in its folder when the file it wrote is there too', () => {
    const lines = [wrote('/repos/app', '/repos/app/src/a.ts')];

    assert.deepEqual(workPlaceOf(lines, rootOf), { cwd: '/repos/app', branch: 'main' });
  });

  it('takes the latest folder of all when none is on a feature branch', () => {
    const lines = [line('/repos/app', 'main'), line('/home/me'), '{ cut short'];

    assert.deepEqual(workPlaceOf(lines, rootOf), { cwd: '/home/me', branch: null });
  });

  it('finds nothing when no line names a folder', () => {
    assert.equal(workPlaceOf([line(undefined), 'not json'], rootOf), null);
  });
});
