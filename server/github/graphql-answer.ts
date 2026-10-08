import { isJson } from './rest-json.ts';

/** A field of an object in a GraphQL answer; anything else reads as missing. */
export const field = (node: unknown, key: string): unknown =>
  isJson(node) ? node[key] : undefined;

/** A connection's `totalCount`; anything else reads as none. */
export const totalIn = (connection: unknown): number => {
  const total = field(connection, 'totalCount');
  return Number.isInteger(total) && Number(total) > 0 ? Number(total) : 0;
};
