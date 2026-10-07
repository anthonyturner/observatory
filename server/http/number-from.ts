import { BadRequest } from './api-handler.ts';

/** Pull request and issue numbers fit in nine digits. */
const NUMBER_DIGITS = 9;
const DIGITS = /^\d+$/;

/** A pull request or issue number from a query or a body, or a BadRequest that names `what`. */
export function numberFrom(value: unknown, what: string, digits = NUMBER_DIGITS): number {
  const text = typeof value === 'number' ? String(value) : value;
  const number = Number(text);
  if (typeof text !== 'string' || !DIGITS.test(text) || text.length > digits || number < 1) {
    throw new BadRequest(`number must be ${what}`);
  }
  return number;
}
