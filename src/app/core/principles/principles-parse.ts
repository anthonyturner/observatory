import { fieldOf, isNumber, isObject, isText, listOf } from '../json/json-fields';
import { Principle, PrinciplesReport } from './principle.types';

function parsePrinciple(value: unknown): Principle | null {
  if (!isObject(value)) return null;
  const id = fieldOf(value, 'id', isText);
  const title = fieldOf(value, 'title', isText);
  const idea = fieldOf(value, 'idea', isText);
  const question = fieldOf(value, 'question', isText);
  return id && title && idea && question ? { id, title, idea, question } : null;
}

/** The principles in an API answer, or null when it holds none or no day. */
export function parsePrinciplesReport(body: unknown): PrinciplesReport | null {
  if (!isObject(body)) return null;
  const principles = listOf(body['principles'], parsePrinciple);
  const today = fieldOf(body, 'today', isNumber);
  if (!principles.length || today === undefined) return null;
  return { principles, today: placeIn(principles.length, today) };
}

/** `place` wrapped round a deck of `count`, so stepping past either end comes round. */
export const placeIn = (count: number, place: number): number =>
  ((Math.trunc(place) % count) + count) % count;
