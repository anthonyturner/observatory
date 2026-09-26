import { BadRequest } from './api-handler.ts';

/** A pull request or issue number from a query or a body, or a BadRequest that names `what`. */
export function numberFrom(value: unknown, what: string): number {
  const text = typeof value === 'number' ? String(value) : value;
  const number = Number(text);
  if (typeof text !== 'string' || !/^\d{1,9}$/.test(text) || number < 1) {
    throw new BadRequest(`number must be ${what}`);
  }
  return number;
}
