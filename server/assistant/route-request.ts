import { BadRequest } from '../http/api-handler.ts';
import { isActable } from './actions.ts';
import { historyOf } from './history-request.ts';
import { MAX_REQUEST_LENGTH, type Pick, type RouteRequest } from './route-contract.ts';

type Json = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null;

function projectOf(pick: Json): string | null {
  const project = pick['project'];
  if (project == null) return null;
  if (typeof project !== 'string') throw new BadRequest('bad pick: no such project');
  return project;
}

/** A pressed button's pick, in shape; whether its project exists is the router's to say. */
function pickOf(pick: Json): Pick {
  const project = projectOf(pick);
  if (pick['action']) {
    if (!isActable(pick['action'])) throw new BadRequest('bad pick: no such action');
    return { action: pick['action'], project };
  }
  const tier = pick['tier'];
  if (tier !== 3) throw new BadRequest('bad pick');
  return { tier, project };
}

function textOf(body: Json): string {
  const text = typeof body['text'] === 'string' ? body['text'].trim() : '';
  if (!text) throw new BadRequest('bad request: nothing to route');
  if (text.length > MAX_REQUEST_LENGTH) {
    throw new BadRequest(`bad request: longer than ${MAX_REQUEST_LENGTH} characters`);
  }
  return text;
}

function skillOf(body: Json): string | null {
  const skill = body['skill'];
  if (skill == null) return null;
  if (typeof skill !== 'string') throw new BadRequest('bad request: no such skill');
  return skill;
}

/** What `POST /api/route` was sent, or a BadRequest. A skill needs no words:
 *  its prompt is fixed, so nothing else is read from the request. */
export function routeRequestFrom(body: unknown): RouteRequest {
  if (!isObject(body) || Array.isArray(body)) throw new BadRequest('body must be an object');
  const skill = skillOf(body);
  const pick = isObject(body['pick']) ? pickOf(body['pick']) : null;
  if (skill !== null) return { skill, pick };
  return { skill, pick, text: textOf(body), history: historyOf(body['history']) };
}
