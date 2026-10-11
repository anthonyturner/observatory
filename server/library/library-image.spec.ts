import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequest, NotFound } from '../http/api-handler.ts';
import {
  type ImageRead,
  MAX_IMAGE_BYTES,
  libraryImage,
  libraryImageResponse,
} from './library-image.ts';
import type { LibrarySources } from './library-report.ts';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function github(files: Record<string, Buffer>, asked: string[] = []): LibrarySources {
  return {
    wikiPage: async () => null,
    defaultBranch: async () => 'trunk',
    filePaths: async () => [],
    fileText: async () => null,
    fileBytes: async (repo, path, ref, maxBytes) => {
      asked.push(`${repo}@${ref}:${path} <=${maxBytes}`);
      return files[path] ?? null;
    },
  };
}

describe('libraryImage', () => {
  it('reads the image at the ref named, else on the default branch', async () => {
    const asked: string[] = [];
    const source = github({ 'docs/a.png': PNG }, asked);

    const named = await libraryImage(source, 'me/app', 'dev', 'docs/a.png');
    await libraryImage(source, 'me/app', null, 'docs/a.png');

    assert.deepEqual(named, { bytes: PNG, type: 'image/png' });
    assert.deepEqual(asked, [
      `me/app@dev:docs/a.png <=${MAX_IMAGE_BYTES}`,
      `me/app@trunk:docs/a.png <=${MAX_IMAGE_BYTES}`,
    ]);
  });

  it('refuses a file that is not an image without reading it', async () => {
    const asked: string[] = [];
    const source = github({ '.env': PNG, 'src/a.ts': PNG }, asked);

    await assert.rejects(libraryImage(source, 'me/app', null, '.env'), BadRequest);
    await assert.rejects(libraryImage(source, 'me/app', null, 'src/a.ts'), BadRequest);
    assert.deepEqual(asked, []);
  });

  it('answers a missing file as not found', async () => {
    await assert.rejects(libraryImage(github({}), 'me/app', null, 'gone.png'), NotFound);
  });
});

describe('libraryImageResponse', () => {
  const read: ImageRead = async (_repo, ref, path) => ({
    bytes: PNG,
    type: path.endsWith('.svg') ? 'image/svg+xml' : `image/png; ref=${ref}`,
  });
  const ask = (query: string): Promise<Response> =>
    libraryImageResponse(read, 'me/app', new URLSearchParams(query));

  it('serves the bytes with their type, a cache header and no sniffing', async () => {
    const response = await ask('path=docs/a.png&ref=main');

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png; ref=main');
    assert.match(response.headers.get('cache-control') ?? '', /^private, max-age=\d+$/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('content-security-policy') ?? '', /sandbox/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), PNG);
  });

  it('reads the default branch when no ref is given', async () => {
    const response = await ask('path=a.png');

    assert.equal(response.headers.get('content-type'), 'image/png; ref=null');
  });

  it('refuses a path that is missing or climbs, and a ref that is not a branch name', async () => {
    for (const query of [
      '',
      'path=',
      'path=../secrets/a.png',
      'path=docs/../../a.png',
      'path=/etc/a.png',
      'path=docs//a.png',
      'path=docs\\a.png',
      'path=a.png&ref=--output',
      'path=a.png&ref=a..b',
    ]) {
      await assert.rejects(ask(query), BadRequest, query);
    }
  });
});
