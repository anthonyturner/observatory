import { BadRequest } from '../http/api-handler.ts';
import { type HistoryTurn, MAX_HISTORY_TURNS, MAX_TURN_LENGTH } from './route-contract.ts';

const isRole = (value: unknown): value is HistoryTurn['role'] =>
  value === 'user' || value === 'assistant';

function turnOf(value: unknown): HistoryTurn {
  if (typeof value !== 'object' || value === null) throw new BadRequest('bad history: not a turn');
  const { role, text } = value as Readonly<Record<string, unknown>>;
  if (!isRole(role)) throw new BadRequest('bad history: no such role');
  if (typeof text !== 'string') throw new BadRequest('bad history: a turn has no text');
  const trimmed = text.trim();
  if (trimmed.length > MAX_TURN_LENGTH) {
    throw new BadRequest(`bad history: a turn is longer than ${MAX_TURN_LENGTH} characters`);
  }
  return { role, text: trimmed };
}

/** The conversation a request continues, or a BadRequest; none when it sent none.
 *  Turns left empty by trimming say nothing, so they are dropped. */
export function historyOf(value: unknown): HistoryTurn[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new BadRequest('bad history: not a list');
  if (value.length > MAX_HISTORY_TURNS) {
    throw new BadRequest(`bad history: more than ${MAX_HISTORY_TURNS} turns`);
  }
  return value.map(turnOf).filter((turn) => turn.text);
}
