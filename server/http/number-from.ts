import { BadRequest } from './api-handler.ts';

/** A pull request or issue number from a request, or a BadRequest that names `what`. */
export function numberFrom(value: string | null, what: string): number {
  const number = Number(value);
  if (!value || !/^\d{1,9}$/.test(value) || number < 1) {
    throw new BadRequest(`number must be ${what}`);
  }
  return number;
}
