import { BadRequest } from '../http/api-handler.ts';
import type { StartRequest } from './proposals.ts';

const FIELDS = ['token', 'prompt', 'folder'] as const;

const isFilledString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/** `POST /api/runs`'s body, or a BadRequest when a field is missing. */
export function startRequestFrom(body: unknown): StartRequest {
  const fields = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const [token, prompt, folder] = FIELDS.map((field) => fields[field]);
  if (!isFilledString(token) || !isFilledString(prompt) || !isFilledString(folder)) {
    throw new BadRequest('token, prompt and folder are required');
  }
  return { token, prompt, folder };
}
