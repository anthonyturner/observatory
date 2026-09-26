import { BadRequest } from '../http/api-handler.ts';

/** An owner and a repository name as GitHub allows them. Neither part may
 *  start with a dash, so nothing that looks like an option reaches `gh`. */
const REPO_NAME = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._][A-Za-z0-9._-]{0,99}$/;

/** `owner/name` from a request, or a BadRequest saying what is wrong. */
export function repoNameFrom(value: string | null): string {
  if (!value) throw new BadRequest('repo is required, as owner/name');
  if (!REPO_NAME.test(value) || value.includes('..')) {
    throw new BadRequest('repo must be a GitHub owner/name');
  }
  return value;
}
