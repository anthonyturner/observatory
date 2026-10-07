import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { newFileDiff } from './new-file-diff.ts';
import { origin, write } from './testing/temp-repo.ts';

const NO_INDEX_DIFFERS = 1;

/** What git itself prints for `path` from nothing, less its `index` line. Git
 *  for Windows reads `/dev/null` as an empty side, as every other git does. */
function gitsOwn(repo: string, path: string): string {
  try {
    execFileSync('git', [
      '-C',
      repo,
      '-c',
      'core.autocrlf=false',
      '-c',
      'core.quotePath=false',
      'diff',
      '--no-index',
      '--no-color',
      '--src-prefix=a/',
      '--dst-prefix=b/',
      '--',
      '/dev/null',
      path,
    ]);
  } catch (error) {
    const failure = error as { status?: unknown; stdout?: Buffer };
    assert.equal(failure.status, NO_INDEX_DIFFERS);
    return String(failure.stdout).replace(/^index .*\n/m, '');
  }
  assert.fail('git found no difference from nothing');
}

const FILES: Readonly<Record<string, string | Buffer>> = {
  'one-line.txt': 'one\n',
  'lines.ts': 'export const a = 1;\n\nexport const b = 2;\n',
  'no-newline.txt': 'first\nlast',
  'crlf.txt': 'one\r\ntwo\r\n',
  'empty.txt': '',
  'with space/é.md': '# Ünïcode\n',
  'logo.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0xfe]),
};

describe('newFileDiff', () => {
  it('prints each new file exactly as git diff --no-index does from /dev/null', () => {
    const repo = origin();
    for (const [path, content] of Object.entries(FILES)) write(repo, path, content);

    for (const [path, content] of Object.entries(FILES)) {
      const ours = newFileDiff({ path, content: Buffer.from(content), mode: '100644' });
      assert.equal(ours, gitsOwn(repo, path), path);
    }
  });

  it('names a binary file and sends none of its bytes', () => {
    const content = Buffer.concat([Buffer.from('PNG'), Buffer.from([0]), Buffer.from('secret')]);

    const diff = newFileDiff({ path: 'a.bin', content, mode: '100644' });

    assert.match(diff, /^Binary files \/dev\/null and b\/a\.bin differ$/m);
    assert.doesNotMatch(diff, /PNG|secret/);
  });
});
