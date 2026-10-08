import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { serviceOfImport } from './network-sdks.ts';
import type { ScannedFile } from './scanned-source.ts';
import { scanSource } from './source-scan.ts';
import { UNKNOWN_TEXT } from './text-parts.ts';
import { textResolver } from './text-resolver.ts';

const filesOf = (sources: Readonly<Record<string, string>>): ScannedFile[] =>
  Object.entries(sources).map(([file, text]) => ({ ...scanSource(file, text), file }));

describe('textResolver', () => {
  const resolve = textResolver(
    filesOf({
      'src/paths.ts': `export const BASE = '/api'; export const QUEUE = BASE + '/queue';`,
      'src/use.ts': `import { QUEUE as Q } from './paths'; const LOCAL = 'x';`,
      'src/loop.ts': `const A = B; const B = A;`,
    }),
    [],
  );

  it('joins literals and looks constants up in the file, or through its import', () => {
    assert.equal(resolve('src/paths.ts', ['', { name: 'QUEUE' }, '/1']), '/api/queue/1');
    assert.equal(
      resolve('src/use.ts', [{ name: 'Q' }, '?a=', { name: 'LOCAL' }]),
      '/api/queue?a=x',
    );
  });

  it('reads what cannot be known as UNKNOWN_TEXT', () => {
    assert.equal(resolve('src/use.ts', ['/api/', { name: null }]), `/api/${UNKNOWN_TEXT}`);
    assert.equal(resolve('src/use.ts', [{ name: 'MISSING' }]), UNKNOWN_TEXT);
  });

  it('gives up on constants that name each other in a loop', () => {
    assert.equal(resolve('src/loop.ts', [{ name: 'A' }]), UNKNOWN_TEXT);
  });
});

describe('serviceOfImport', () => {
  it('names the service of a network package, by package, by scope and through a subpath', () => {
    assert.equal(serviceOfImport('imapflow'), 'imap-server');
    assert.equal(serviceOfImport('@octokit/rest'), 'github');
    assert.equal(serviceOfImport('firebase/app'), 'firebase');
  });

  it('names none for the project’s own modules, built-ins and other packages', () => {
    for (const specifier of ['./imapflow', '@/app/mail', 'node:http', 'rxjs', '@angular/core']) {
      assert.equal(serviceOfImport(specifier), null, specifier);
    }
  });
});
