import { type JsonGet, isJson, isNotFound } from './rest-json.ts';

/** What the Releases screen reads of a repository's changelog, and nothing else. */
export interface ChangelogReader {
  /** `CHANGELOG.md` on the default branch, or null where there is none. */
  changelog(repo: string): Promise<string | null>;
}

export const CHANGELOG_PATH = 'CHANGELOG.md';

/** A file's text from a `GET /contents/{path}` answer, which GitHub sends as base64; null for anything else. */
export function fileTextOf(body: unknown): string | null {
  if (!isJson(body) || body['encoding'] !== 'base64' || typeof body['content'] !== 'string') {
    return null;
  }
  return Buffer.from(body['content'], 'base64').toString('utf8');
}

/** A repository without a changelog is ordinary; any other failure is passed on. */
export async function readChangelog(get: JsonGet, repo: string): Promise<string | null> {
  try {
    return fileTextOf(await get(`repos/${repo}/contents/${CHANGELOG_PATH}`));
  } catch (error: unknown) {
    if (isNotFound(error)) return null;
    throw error;
  }
}
