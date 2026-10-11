import { BadRequest, NotFound } from '../http/api-handler.ts';
import { imageTypeOf } from '../wiki/image-types.ts';
import type { LibrarySources } from './library-report.ts';

/** A screenshot or diagram; the API will not carry a larger file for a page to draw. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** A repository image changes only when its branch moves; a few minutes is as fresh as a page is. */
const IMAGE_MAX_AGE_SECONDS = 300;
const REF = /^[A-Za-z0-9_][A-Za-z0-9._/-]{0,199}$/;

/** An image file's bytes and the type it is served as. */
export interface LibraryImage {
  readonly bytes: Buffer;
  readonly type: string;
}

/** Reads a repository's image at a ref, or the default branch where none is named. */
export type ImageRead = (repo: string, ref: string | null, path: string) => Promise<LibraryImage>;

/** The image a repository's default branch or `ref` holds at `path`; NotFound where there is none. */
export async function libraryImage(
  github: LibrarySources,
  repo: string,
  ref: string | null,
  path: string,
): Promise<LibraryImage> {
  const type = imageTypeOf(path);
  if (type === null) throw new BadRequest('path must be an image file');
  const bytes = await github.fileBytes(
    repo,
    path,
    ref ?? (await github.defaultBranch(repo)),
    MAX_IMAGE_BYTES,
  );
  if (bytes === null) throw new NotFound(`no image ${path} in ${repo}`);
  return { bytes, type };
}

function refFrom(value: string | null): string | null {
  if (value === null || value === '') return null;
  if (!REF.test(value) || value.includes('..')) throw new BadRequest('ref must be a branch or tag');
  return value;
}

function pathFrom(value: string | null): string {
  const segments = (value ?? '').split('/');
  const isPlain = (segment: string): boolean =>
    segment !== '' &&
    segment !== '.' &&
    segment !== '..' &&
    ![...segment].some((char) => char === '\\' || char.charCodeAt(0) < 32);
  if (!value || !segments.every(isPlain)) {
    throw new BadRequest('path must be a file in the repository');
  }
  return value;
}

/**
 * `GET /api/library/image?repo=owner/name&path=docs/shot.png[&ref=main]`: one
 * image file of the repository, read with the API's own GitHub access, so a
 * private repository's pages can draw its images. Only image files are
 * served, each as the type its extension names, and only from the repository
 * asked for: it reads nothing else and never fetches an address it is given.
 */
export async function libraryImageResponse(
  read: ImageRead,
  repo: string,
  query: URLSearchParams,
): Promise<Response> {
  const path = pathFrom(query.get('path'));
  const { bytes, type } = await read(repo, refFrom(query.get('ref')), path);
  return new Response(new Uint8Array(bytes), {
    headers: {
      'content-type': type,
      // The same repository's images are shown to the signed-in reader only.
      'cache-control': `private, max-age=${IMAGE_MAX_AGE_SECONDS}`,
      'x-content-type-options': 'nosniff',
      // An SVG opened on its own address must not run script on this origin.
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
