import type { MergeRequest, PullChanges } from '../github/pull-writer.ts';
import { BadRequest } from '../http/api-handler.ts';
import { pullNumberFrom } from '../queue/pull-detail.ts';
import { repoNameFrom } from '../queue/repo-name.ts';

/** Everything the Edit tab can ask for: the reversible changes, and the two decisions. */
export interface EditChanges extends PullChanges {
  /** Take it out of draft. */
  readonly ready?: true;
  readonly merge?: MergeRequest;
}

export interface EditRequest {
  readonly repo: string;
  readonly number: number;
  readonly changes: EditChanges;
}

/** Which pull request an edit is about. */
export interface EditTarget {
  readonly repo: string;
  readonly number: number;
}

type Json = Readonly<Record<string, unknown>>;

const LIST_KEYS = [
  'addLabels',
  'removeLabels',
  'addAssignees',
  'removeAssignees',
  'addReviewers',
  'removeReviewers',
] as const;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function textOf(changes: Json, key: 'title' | 'body'): Partial<PullChanges> {
  const value = changes[key];
  if (value === undefined) return {};
  if (typeof value !== 'string') throw new BadRequest(`${key} must be text`);
  return { [key]: value };
}

function listOf(changes: Json, key: (typeof LIST_KEYS)[number]): Partial<PullChanges> {
  const value = changes[key];
  if (value === undefined) return {};
  if (!Array.isArray(value) || !value.every((each) => typeof each === 'string')) {
    throw new BadRequest(`${key} must be a list of names`);
  }
  return value.length ? { [key]: value as string[] } : {};
}

/** A merge's shape; whether its method and commit are acceptable is a rule, checked later. */
function mergeOf(value: unknown): { merge?: MergeRequest } {
  if (value === undefined) return {};
  if (
    !isObject(value) ||
    typeof value['method'] !== 'string' ||
    typeof value['headOid'] !== 'string'
  ) {
    throw new BadRequest('merge must name a method and a commit');
  }
  return { merge: { method: value['method'], headOid: value['headOid'] } as MergeRequest };
}

function changesFrom(value: unknown): EditChanges {
  if (!isObject(value)) throw new BadRequest('changes must be an object');
  const changes: EditChanges = {
    ...textOf(value, 'title'),
    ...textOf(value, 'body'),
    ...Object.assign({}, ...LIST_KEYS.map((key) => listOf(value, key))),
    ...(value['ready'] === true ? { ready: true } : {}),
    ...mergeOf(value['merge']),
  };
  if (!Object.keys(changes).length) throw new BadRequest('there is nothing to change');
  return changes;
}

/** Which pull request a request names, or a BadRequest. */
export function editTargetFrom(body: unknown): EditTarget {
  if (!isObject(body)) throw new BadRequest('body must be an object');
  return {
    repo: repoNameFrom(typeof body['repo'] === 'string' ? body['repo'] : null),
    number: pullNumberFrom(body['number']),
  };
}

/** An edit as the page sent it, in shape; what it asks for is checked by the rules. */
export function editRequestFrom(body: unknown): EditRequest {
  const target = editTargetFrom(body);
  return { ...target, changes: changesFrom((body as Json)['changes']) };
}
