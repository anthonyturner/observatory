import type { RouteTable } from '../http/api-handler.ts';

export const ARCHITECTURE_PATH = '/api/architecture';

/** `table` with the architecture map. Only the local API adds it: the map stays on this machine. */
export function withArchitectureRoutes(
  table: RouteTable,
  read: () => Promise<unknown>,
): RouteTable {
  return { ...table, get: { ...table.get, [ARCHITECTURE_PATH]: () => read() } };
}
