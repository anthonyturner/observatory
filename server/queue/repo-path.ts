import { BadRequest } from '../http/api-handler.ts';

const CONTROL_CHARACTERS_BELOW = 32;

const isPlainSegment = (segment: string): boolean =>
  segment !== '' &&
  segment !== '.' &&
  segment !== '..' &&
  ![...segment].some((char) => char === '\\' || char.charCodeAt(0) < CONTROL_CHARACTERS_BELOW);

/** A file's path in a repository from a request: slash-separated plain names that stay inside it,
 *  or a BadRequest. */
export function repoPathFrom(value: string | null): string {
  if (!value || !value.split('/').every(isPlainSegment)) {
    throw new BadRequest('path must be a file in the repository');
  }
  return value;
}
