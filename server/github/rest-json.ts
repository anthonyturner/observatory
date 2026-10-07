/** Reads one GitHub REST path, from below the API's root, as JSON. */
export type JsonGet = (path: string) => Promise<unknown>;

/** A JSON object whose fields have not been checked yet. */
export type Json = Readonly<Record<string, unknown>>;

export const isJson = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

/** The objects in a REST answer that is a list; anything else reads as none. */
export const jsonList = (body: unknown): Json[] => (Array.isArray(body) ? body.filter(isJson) : []);

/** `gh api` and the REST client both put the status in their error: a path that is not there. */
const NOT_FOUND = /HTTP 404/;

export const isNotFound = (error: unknown): boolean =>
  error instanceof Error && NOT_FOUND.test(error.message);
