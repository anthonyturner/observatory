/** A JSON object whose fields have not been checked yet. */
export type Json = Record<string, unknown>;

export const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isText = (value: unknown): value is string =>
  typeof value === 'string' && value !== '';

export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const oneOf =
  <T>(allowed: readonly T[]) =>
  (value: unknown): value is T =>
    allowed.includes(value as T);

export const listOf = <T>(value: unknown, parse: (item: unknown) => T | null): T[] =>
  (Array.isArray(value) ? value : []).map(parse).filter((item): item is T => item !== null);

/** The field when it passes `check`, else nothing, so an odd field is dropped
 *  rather than trusted. */
export function fieldOf<T>(
  body: Json,
  key: string,
  check: (value: unknown) => value is T,
): T | undefined {
  const value = body[key];
  return check(value) ? value : undefined;
}
