import type { RouteTable } from '../http/api-handler.ts';
import { principlesOn } from './principle-of-day.ts';

export const PRINCIPLES_PATH = '/api/principles';

/** `table` with Home's principle of the day, for the page's own calendar day
 *  (`?day=YYYY-MM-DD`). It is the same text for everyone. */
export function withPrincipleRoutes(
  table: RouteTable,
  now: () => Date = () => new Date(),
): RouteTable {
  return {
    ...table,
    get: {
      ...table.get,
      [PRINCIPLES_PATH]: async (query) => principlesOn(query.get('day'), now()),
    },
  };
}
