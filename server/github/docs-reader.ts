import { fileTextOf } from './changelog-reader.ts';
import { type JsonGet, isJson, isNotFound, isText, jsonListIn } from './rest-json.ts';

/** What the Library reads of a repository's files when it has no wiki, and nothing else. */
export interface DocsReader {
  /** Every file's path on `ref`, as the repository's tree lists them. */
  filePaths(repo: string, ref: string): Promise<string[]>;
  /** One file's text on `ref`, or null when GitHub does not send it as a file. */
  fileText(repo: string, path: string, ref: string): Promise<string | null>;
  /** One file's bytes on `ref`, or null when there is no such file or it is over `maxBytes`. */
  fileBytes(repo: string, path: string, ref: string, maxBytes: number): Promise<Buffer | null>;
}

/** The files, not the folders, in a `GET /git/trees/{ref}?recursive=1` answer. */
export const treePathsOf = (body: unknown): string[] =>
  jsonListIn(body, 'tree').flatMap(({ type, path }) =>
    type === 'blob' && isText(path) ? [path] : [],
  );

const encodedPath = (path: string): string => path.split('/').map(encodeURIComponent).join('/');

export async function readFilePaths(get: JsonGet, repo: string, ref: string): Promise<string[]> {
  return treePathsOf(await get(`repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`));
}

export async function readFileText(
  get: JsonGet,
  repo: string,
  path: string,
  ref: string,
): Promise<string | null> {
  return fileTextOf(
    await get(`repos/${repo}/contents/${encodedPath(path)}?ref=${encodeURIComponent(ref)}`),
  );
}

const bytesOf = (blob: unknown): Buffer | null =>
  isJson(blob) && blob['encoding'] === 'base64' && typeof blob['content'] === 'string'
    ? Buffer.from(blob['content'], 'base64')
    : null;

export async function readFileBytes(
  get: JsonGet,
  repo: string,
  path: string,
  ref: string,
  maxBytes: number,
): Promise<Buffer | null> {
  try {
    const file = await get(
      `repos/${repo}/contents/${encodedPath(path)}?ref=${encodeURIComponent(ref)}`,
    );
    if (!isJson(file) || file['type'] !== 'file' || Number(file['size']) > maxBytes) return null;
    // The contents answer holds a file's bytes only up to 1 MB; the blob, by its sha, up to 100 MB.
    const sha = file['sha'];
    return file['encoding'] === 'base64' || typeof sha !== 'string'
      ? bytesOf(file)
      : bytesOf(await get(`repos/${repo}/git/blobs/${encodeURIComponent(sha)}`));
  } catch (error: unknown) {
    if (isNotFound(error)) return null;
    throw error;
  }
}
